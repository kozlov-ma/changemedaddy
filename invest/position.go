package invest

import "time"

type PositionStatus int

const (
	StatusOpen PositionStatus = iota + 1
	StatusClosed
)

type InstrumentType int

const (
	TypeShares InstrumentType = iota + 1
	TypeFutures
)

type PositionKind int

const (
	KindLong PositionKind = iota + 1
	KindShort
)

// A Position represents a position on the security market. Essentially, it
// describes what was bought, how many, when, and what changes were made since then.
type Position struct {
	// A Ticker is a string code for the security, like YNDX, GAZP, USDRUBF or WUSH-6.24
	Ticker string `validate:"required,min=1,max=12"`
	// Kind tells whether a position is long or short.
	// CHECK WIKIPEDIA IF YOU DON'T KNOW WHAT ARE THESE.
	Kind PositionKind `validate:"required,oneof=1 2"`
	// InstrumentType tells whether the asset is Shares, Futures, Bonds, etc.
	InstrumentType InstrumentType `validate:"required,oneof=1 2"`
	// RelAmount is amount of lots in a position.
	RelAmount int `validate:"gte=0"`
	// StartPrice is a weighted average of all purchases or sales of the  security.
	StartPrice float64 `validate:"required,gt=0"`
	// TargetPrice is a price at which the author of the idea intends to close this position.
	TargetPrice float64 `validate:"required,gt=0"`
	// FixedProfitP is all the profit fixed at the moment relative to the invested capital.
	// It is all the profit if the Position is closed.
	FixedProfitP float64
	// Author usually intends to close the Position before Deadline.
	Deadline time.Time `validate:"required"`
	// Log contains all the changes that happened to this Position.
	Log []PositionChange
}

// Status tells whether a position is open or closed.
// You cannot change any information about a closed position.
func (p Position) Status() PositionStatus {
	if p.RelAmount == 0 {
		return StatusClosed
	}

	return StatusOpen
}
