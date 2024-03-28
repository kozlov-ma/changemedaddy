package invest

import "time"

type IdeaChange interface {
	Apply(Idea) Idea
	When() time.Time
	Check(Idea) error
}

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
