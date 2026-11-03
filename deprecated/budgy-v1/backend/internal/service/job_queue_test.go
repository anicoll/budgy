package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"budgeting_system/internal/domain"
	dmocks "budgeting_system/internal/domain/mocks"
	smocks "budgeting_system/internal/service/mocks"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestJobQueue_Enqueue(t *testing.T) {
	mockJobsRepo := dmocks.NewMockJobRepository(t)
	mockBankSyncSvc := smocks.NewMockBankSyncService(t)

	q := NewJobQueue(mockJobsRepo, mockBankSyncSvc)

	mockJobsRepo.On("Create", mock.Anything, mock.MatchedBy(func(j *domain.Job) bool {
		return j.JobType == "sync_basiq_user" && j.Status == domain.JobStatusPending
	})).Return(nil)

	err := q.Enqueue(context.Background(), "sync_basiq_user", map[string]string{"local_user_id": "u-1"})
	assert.NoError(t, err)
}

func TestJobQueue_WorkerLoop_Success(t *testing.T) {
	mockJobsRepo := dmocks.NewMockJobRepository(t)
	mockBankSyncSvc := smocks.NewMockBankSyncService(t)

	q := NewJobQueue(mockJobsRepo, mockBankSyncSvc).(*jobQueue)

	job := &domain.Job{
		ID:          "job-1",
		JobType:     "sync_basiq_user",
		Payload:     `{"local_user_id":"u-1", "basiq_user_id":"b-1"}`,
		Status:      domain.JobStatusPending,
		Attempts:    0,
		MaxAttempts: 5,
		RunAt:       time.Now(),
	}

	// 1. GetNextPending finds a job
	mockJobsRepo.On("GetNextPending", mock.Anything).Return(job, nil)

	// 2. Lock to running
	mockJobsRepo.On("UpdateStatus", mock.Anything, "job-1", domain.JobStatusRunning, 1, mock.Anything, (*string)(nil)).Return(nil)

	// 3. BankSyncService executes successfully
	mockBankSyncSvc.On("SyncUser", mock.Anything, "u-1").Return(nil)

	// 4. Job is deleted on success
	mockJobsRepo.On("Delete", mock.Anything, "job-1").Return(nil)

	// Execute single process iteration
	q.processNextJob()
}

func TestJobQueue_WorkerLoop_Failure_Retry(t *testing.T) {
	mockJobsRepo := dmocks.NewMockJobRepository(t)
	mockBankSyncSvc := smocks.NewMockBankSyncService(t)

	q := NewJobQueue(mockJobsRepo, mockBankSyncSvc).(*jobQueue)

	job := &domain.Job{
		ID:          "job-2",
		JobType:     "sync_basiq_user",
		Payload:     `{"local_user_id":"u-2", "basiq_user_id":"b-2"}`,
		Status:      domain.JobStatusPending,
		Attempts:    0,
		MaxAttempts: 5,
		RunAt:       time.Now(),
	}

	// 1. Find job
	mockJobsRepo.On("GetNextPending", mock.Anything).Return(job, nil)

	// 2. Lock to running
	mockJobsRepo.On("UpdateStatus", mock.Anything, "job-2", domain.JobStatusRunning, 1, mock.Anything, (*string)(nil)).Return(nil)

	// 3. SyncUser returns error
	syncErr := errors.New("sync failed")
	mockBankSyncSvc.On("SyncUser", mock.Anything, "u-2").Return(syncErr)

	// 4. Update status back to pending with backoff and error message
	mockJobsRepo.On("UpdateStatus", mock.Anything, "job-2", domain.JobStatusPending, 1, mock.Anything, mock.MatchedBy(func(errStr *string) bool {
		return errStr != nil && *errStr == "sync failed"
	})).Return(nil)

	q.processNextJob()
}
