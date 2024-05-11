package position

import "errors"

var (
	ErrNotFound               = errors.New("position not found")
	ErrConflict               = errors.New("position with the same ID already exists")
	ErrClosedPositionModified = errors.New("cannot modify a closed position")

	ErrTicker        = errors.New("cannot create position: instrument with this ticker does not exist")
	ErrParseType     = errors.New("position type does not exist")
	ErrTargetPrice   = errors.New("wrong target price")
	ErrParseDeadline = errors.New("couldn't parse deadline")
)
