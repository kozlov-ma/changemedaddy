package idea

import "errors"

var (
	ErrNotFound           = errors.New("idea not found")
	ErrConflict           = errors.New("idea with the same slug (or name) already exists")
	ErrClosedIdeaModified = errors.New("cannot change a closed idea")

	ErrNameTooShort = errors.New("idea name must be at least 3 characters long")
	ErrNameTooLong  = errors.New("idea name must be at most 55 characters long")
)
