package invest

import "time"

const maxHoursSinceChange = 24

// PositionChange represents a change that the author of the idea makes to one
// of ideas position after their creation. For example, change the Position.TargetPrice.
type PositionChange interface {
	// Apply is a method that takes a Position and returns another Position
	// with the change applied to it.
	// The change must appear in the new Position's log.
	Apply(Position) Position
	// When is the time when this PositionChange occurred. Is intended for sorting.
	When() time.Time
	// Check checks whether this specific PositionChange is valid for the specific Position.
	// Returns an error if it is not valid, otherwise returns nil.
	Check(Position) error
}

func baseCheck(p Position, pc PositionChange) error {
	if p.Status() == StatusClosed {
		return CannotChangeClosedPosition
	}

	if time.Now().Sub(pc.When()).Hours() > maxHoursSinceChange {
		return InvalidChangeTime
	}

	return nil
}
