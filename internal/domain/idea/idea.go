package idea

import (
	"changemedaddy/internal/domain/position"
	"context"
)

type Idea struct {
	ID int `bson:"id"`
	// Author      *analyst.Analyst
	Positions []position.Position `bson:"positions"`
}

// ideaSaver saves Idea s.
type ideaSaver interface {
	// Save saves the Idea i. It also saves all the positions of the Idea.
	Save(ctx context.Context, i *Idea) error
}

// Save saves the Idea i to the ideaSaver. It also saves all the positions of the Idea.
func (i *Idea) Save(ctx context.Context, is ideaSaver) error {
	return is.Save(ctx, i)
}
