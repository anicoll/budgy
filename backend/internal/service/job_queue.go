package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sync"
	"time"

	"budgeting_system/internal/domain"
	"go.uber.org/zap"
)

// JobQueue manages background asynchronous task processing.
type JobQueue interface {
	Enqueue(ctx context.Context, jobType string, payload any) error
	Start(ctx context.Context)
	Stop()
}

type jobQueue struct {
	jobsRepo    domain.JobRepository
	bankSyncSvc BankSyncService
	stopChan    chan struct{}
	doneChan    chan struct{}
	mu          sync.Mutex
	running     bool
}

// NewJobQueue creates a new JobQueue instance.
func NewJobQueue(jobsRepo domain.JobRepository, bankSyncSvc BankSyncService) JobQueue {
	return &jobQueue{
		jobsRepo:    jobsRepo,
		bankSyncSvc: bankSyncSvc,
		stopChan:    make(chan struct{}),
		doneChan:    make(chan struct{}),
	}
}

// Enqueue serializes a payload and saves a pending job in the database.
func (q *jobQueue) Enqueue(ctx context.Context, jobType string, payload any) error {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal job payload: %w", err)
	}

	jobID := generateID()
	job := &domain.Job{
		ID:          jobID,
		JobType:     jobType,
		Payload:     string(payloadBytes),
		Status:      domain.JobStatusPending,
		Attempts:    0,
		MaxAttempts: 5,
		RunAt:       time.Now(),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := q.jobsRepo.Create(ctx, job); err != nil {
		return fmt.Errorf("failed to save job: %w", err)
	}

	zap.S().Debugf("Job Queue: Enqueued job %s of type %s", jobID, jobType)
	return nil
}

// Start spawns the background worker goroutine.
func (q *jobQueue) Start(ctx context.Context) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.running {
		return
	}
	q.running = true

	go q.workerLoop()
}

// Stop signals the background worker to shut down gracefully and blocks until complete.
func (q *jobQueue) Stop() {
	q.mu.Lock()
	if !q.running {
		q.mu.Unlock()
		return
	}
	q.running = false
	q.mu.Unlock()

	close(q.stopChan)
	<-q.doneChan
}

func (q *jobQueue) workerLoop() {
	defer close(q.doneChan)
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	zap.S().Info("Background job queue worker started.")

	for {
		select {
		case <-q.stopChan:
			zap.S().Info("Background job queue worker shutting down.")
			return
		case <-ticker.C:
			q.processNextJob()
		}
	}
}

func (q *jobQueue) processNextJob() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	job, err := q.jobsRepo.GetNextPending(ctx)
	if err != nil {
		// Normal case when there are no pending jobs ready to run
		return
	}

	zap.S().Infof("Job Queue: Processing job %s (type: %s, attempt: %d)", job.ID, job.JobType, job.Attempts+1)

	// Transition job to running and increment attempts count
	job.Attempts++
	job.Status = domain.JobStatusRunning
	if err := q.jobsRepo.UpdateStatus(ctx, job.ID, job.Status, job.Attempts, job.RunAt, nil); err != nil {
		zap.S().Errorf("Job Queue: Failed to update job status to running for %s: %v", job.ID, err)
		return
	}

	// Execute job payload
	err = q.execute(ctx, job)
	if err != nil {
		zap.S().Errorf("Job Queue: Job %s execution failed: %v", job.ID, err)
		errMsg := err.Error()

		if job.Attempts >= job.MaxAttempts {
			// Permanently failed
			job.Status = domain.JobStatusFailed
			_ = q.jobsRepo.UpdateStatus(ctx, job.ID, job.Status, job.Attempts, job.RunAt, &errMsg)
			zap.S().Errorf("Job Queue: Job %s failed permanently after %d attempts", job.ID, job.Attempts)
		} else {
			// Exponential backoff: 10s * 2^attempts
			backoffSeconds := 10 * math.Pow(2, float64(job.Attempts-1))
			runAt := time.Now().Add(time.Duration(backoffSeconds) * time.Second)
			job.Status = domain.JobStatusPending // reset to pending so it can be picked up again
			_ = q.jobsRepo.UpdateStatus(ctx, job.ID, job.Status, job.Attempts, runAt, &errMsg)
			zap.S().Warnf("Job Queue: Job %s will be retried at %s (retry attempt %d/%d)", job.ID, runAt.Format(time.RFC3339), job.Attempts, job.MaxAttempts)
		}
		return
	}

	// Successfully completed; delete from the DB to keep SQLite storage lightweight
	zap.S().Infof("Job Queue: Job %s completed successfully", job.ID)
	if err := q.jobsRepo.Delete(ctx, job.ID); err != nil {
		zap.S().Errorf("Job Queue: Failed to delete completed job %s: %v", job.ID, err)
	}
}

func (q *jobQueue) execute(ctx context.Context, job *domain.Job) error {
	switch job.JobType {
	case "sync_basiq_user":
		var payload struct {
			LocalUserID string `json:"local_user_id"`
			BasiqUserID string `json:"basiq_user_id"`
		}
		if err := json.Unmarshal([]byte(job.Payload), &payload); err != nil {
			return fmt.Errorf("failed to parse payload: %w", err)
		}

		if payload.LocalUserID == "" {
			return fmt.Errorf("local_user_id is missing in payload")
		}

		return q.bankSyncSvc.SyncUser(ctx, payload.LocalUserID)

	default:
		return fmt.Errorf("unknown job type: %s", job.JobType)
	}
}
