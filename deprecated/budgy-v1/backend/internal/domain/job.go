package domain

import (
	"context"
	"time"
)

// JobStatus represents the state of a background job.
type JobStatus string

const (
	JobStatusPending   JobStatus = "pending"
	JobStatusRunning   JobStatus = "running"
	JobStatusCompleted JobStatus = "completed"
	JobStatusFailed    JobStatus = "failed"
)

// Job represents a background job stored in the database.
type Job struct {
	ID           string
	JobType      string
	Payload      string // JSON string
	Status       JobStatus
	Attempts     int
	MaxAttempts  int
	RunAt        time.Time
	ErrorMessage *string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// JobRepository defines the storage interface for background jobs.
type JobRepository interface {
	Create(ctx context.Context, job *Job) error
	GetNextPending(ctx context.Context) (*Job, error)
	UpdateStatus(ctx context.Context, id string, status JobStatus, attempts int, runAt time.Time, errMsg *string) error
	Delete(ctx context.Context, id string) error
}
