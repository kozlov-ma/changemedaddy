package idea

import "errors"

var (
	ErrNotFound = errors.New("idea not found")
	ErrConflict = errors.New("idea with the same slug (or name) already exists")
)
