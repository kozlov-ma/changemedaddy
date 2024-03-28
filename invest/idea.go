package invest

import "time"

type Idea struct {
	ID        int64
	Positions []Position
	Deadline  time.Time
	Log       []IdeaChange
}

type IdeaChange interface {
	Apply(Idea) Idea
	When() time.Time
}

type DeadlineChange struct {
	NewDeadline time.Time
}
