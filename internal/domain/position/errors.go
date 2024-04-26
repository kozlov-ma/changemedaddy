package position

import "errors"

var (
	ErrNotFound               = errors.New("position not found")
	ErrConflict               = errors.New("position with the same ID already exists")
	ErrClosedPositionModified = errors.New("cannot modify a closed position")
)
