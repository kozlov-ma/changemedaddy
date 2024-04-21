package types

import "errors"

var (
	ErrCannotFlipPosition = errors.New("this update will result in a position being flipped. Doing such is forbidden")

	ErrDeadlinePassed = errors.New("this update sets the deadline to a one that is already passed.")

	ErrNonPositivePrice = errors.New("non-positive prices are not allowed")
)
