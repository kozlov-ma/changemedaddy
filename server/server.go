package server

import "changemedaddy/invest"

// create
type IdeaCreator interface {
	CreateIdea() (invest.Idea, error)
}

// update
type IdeaSaver interface {
	SaveIdea(invest.Idea) error
}

// get
type IdeaProvider interface {
	GetIdea(int64) (invest.Idea, error)
}

// create position
type PositionCreator interface {
	CreatePosition() (invest.Position, error)
}

// update position
type PositionSaver interface {
	SavePosition() error
}

// get position
type PositionProvider interface {
	GetPosition(int64) (invest.Position, error)
}
