package idea

import (
	"context"
	"fmt"

	"github.com/gosimple/slug"
)

type Idea struct {
	ID         int    `bson:"_id"`
	Name       string `bson:"name"`
	Slug       string `bson:"slug"`
	AuthorName string `bson:"author_name"`
	SourceLink string `bson:"source_link"`
	// Author      *analyst.Analyst
	PositionIDs []int `bson:"position_ids"`
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

type IdeaOptions struct {
	Name        string
	AuthorName  string
	SourceLink  string
	PositionIDs []int
}

func NewIdea(ctx context.Context, is ideaSaver, opt IdeaOptions) (*Idea, error) {
	i := &Idea{
		Name:        opt.Name,
		Slug:        slug.Make(opt.Name),
		AuthorName:  opt.AuthorName,
		SourceLink:  opt.SourceLink,
		PositionIDs: opt.PositionIDs,
	}

	err := i.Save(ctx, is)
	if err != nil {
		return nil, fmt.Errorf("couldn't save idea: %w", err)
	}

	return i, nil
}

// type WithProfit struct {
// 	*Idea
// 	Positions []position.WithProfit
// 	ProfitP   decimal.Decimal
// }

// type priceProvider interface {
// 	Price(ctx context.Context, i *instrument.Instrument) (decimal.Decimal, error)
// }

// func (i *Idea) WithProfit(ctx context.Context, pp priceProvider) (WithProfit, error) {
// 	var (
// 		mu      sync.Mutex
// 		wpp     = make([]position.WithProfit, 0, len(i.Positions))
// 		profitP decimal.Decimal
// 	)

// 	eg, ctx := errgroup.WithContext(ctx)
// 	for _, p := range i.Positions {
// 		p := p
// 		eg.Go(func() error {
// 			wp, err := p.WithProfit(ctx, pp)
// 			if err != nil {
// 				return fmt.Errorf("couldn't get position profit (id %v): %w", p.ID, err)
// 			}

// 			mu.Lock()
// 			defer mu.Unlock()

// 			wpp = append(wpp, wp)
// 			profitP = profitP.Add(wp.ProfitP).Mul(p.IdeaPartP).Div(decimal.NewFromInt(100))

// 			return nil
// 		})
// 	}

// 	if err := eg.Wait(); err != nil {
// 		return WithProfit{}, fmt.Errorf("couldn't get idea profits: %w", err)
// 	}

// 	return WithProfit{
// 		Idea:      i,
// 		Positions: wpp,
// 		ProfitP:   profitP,
// 	}, nil
// }
