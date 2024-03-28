package invest

import "errors"

var (
	CannotChangeClosedPosition = errors.New("cannot change a closed position")

	InvalidChangeTime  = errors.New("invalid change time")
	InvalidTargetPrice = errors.New("invalid target price")

	InvalidPrice   = errors.New("invalid price")
	ZeroDeltaError = errors.New("cannot change position for 0 lots")
	TooBigAbsDelta = errors.New("this delta will lead to the position being flipped")

	InvalidDeadline = errors.New("given deadline is too far before the current time")
)
