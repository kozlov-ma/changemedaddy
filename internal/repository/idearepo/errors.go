package idearepo

import "errors"

var (
	ErrIdeaCreating = errors.New("there was an error inserting the idea to repo")
	ErrIdeaFinding  = errors.New("idea was not found")
)
