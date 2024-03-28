package invest

import "time"

// An Idea represents an investment idea. It consists of one or more Positions.
type Idea struct {
	// Idea has one or more positions.
	Positions []Position
	// Author of the idea usually intends to close all the Positions before Deadline.
	Deadline time.Time
	// Log contains all the changes that happened to the Idea.
	Log []IdeaChange
}
