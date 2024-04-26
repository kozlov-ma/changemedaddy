package idea

import "errors"

var (
	ErrDuplicate = errors.New("an idea with this slug already exists")
)
