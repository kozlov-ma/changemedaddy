package position

import "errors"

var (
	ErrClosedPositionModified = errors.New("cannot modify a closed position")
)
