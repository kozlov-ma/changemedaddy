package invest

import "time"

// IdeaChange represents a change that the author of the idea makes to it
// after its creation. For example, change the Idea.Deadline.
type IdeaChange interface {
	// Apply is a method that takes an Idea and returns another Idea with the
	// change applied to it.
	// The change must appear in the new Idea's log.
	Apply(Idea) Idea
	// When is the time when this IdeaChange occurred. Is intended for sorting.
	When() time.Time
	// Check checks whether this specific IdeaChange is valid for the specific Idea.
	// Returns an error if it is not valid, otherwise returns nil.
	Check(Idea) error
}

// DeadlineChange changes the Idea.Deadline.
type DeadlineChange struct {
	Time        time.Time
	NewDeadline time.Time
}

func (d DeadlineChange) Apply(i Idea) Idea {
	i.Log = append(i.Log, d)
	i.Deadline = d.NewDeadline

	return i
}

func (d DeadlineChange) When() time.Time {
	return d.Time
}

func (d DeadlineChange) Check(Idea) error {
	if d.Time.Before(minChangeTime) {
		return InvalidChangeTime
	}

	if time.Now().Sub(d.NewDeadline).Hours() >= 24 {
		return InvalidDeadline
	}

	return nil
}
