package update

import "errors"

var (
	ErrCannotFlipPosition = errors.New("cannot flip position")
	ErrDeadlinePassed     = errors.New("deadline passed")
	ErrNonPositivePrice   = errors.New("non-positive price")
)
