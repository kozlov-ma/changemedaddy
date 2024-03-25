package server

import "changemedaddy/invest"

// create
type IdeaSaver interface {
	SaveIdea(invest.Idea) (invest.Idea, error)
}

// update
type IdeaUpdater interface {
	UpdateIdea(idea invest.Idea) error
}

// get
type IdeaProvider interface {
	GetIdea(int64) (invest.Idea, error)
}

// update position
type PositionUpdater interface {
	UpdatePosition(invest.Position) error
}

// get position
type PositionProvider interface {
	GetPosition(int64) (invest.Position, error)
}
