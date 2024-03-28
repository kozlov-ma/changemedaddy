package invest

import "time"

type Idea struct {
	Positions []Position
	Deadline  time.Time
	Log       []IdeaChange
}
