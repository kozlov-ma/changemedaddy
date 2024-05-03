package idea

import (
	"changemedaddy/internal/domain/instrument"
	"changemedaddy/internal/domain/position"
	"changemedaddy/internal/pkg/assert"
	"context"
	"fmt"

	"github.com/gosimple/slug"
	"github.com/greatcloak/decimal"
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

type CreationOptions struct {
	Name        string
	AuthorName  string
	SourceLink  string
	PositionIDs []int
}

func New(ctx context.Context, is ideaSaver, opt CreationOptions) (*Idea, error) {
	assert.That(len(opt.Name) > 0, "empty idea name in trusted data")
	assert.That(len(opt.PositionIDs) > 0, "no positions in trusted IdeaOptions data")

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

type positionSaver interface {
	Save(ctx context.Context, p *position.Position) error
}

type priceProvider interface {
	Price(ctx context.Context, i *instrument.Instrument) (decimal.Decimal, error)
}

type instrumentProvider interface {
	Find(ctx context.Context, ticker string) (*instrument.Instrument, error)
}

type marketProvider interface {
	priceProvider
	instrumentProvider
}

type ideaUpdater interface {
	Update(ctx context.Context, i *Idea) error
}

func (i *Idea) NewPosition(ctx context.Context, mp marketProvider, ps positionSaver, iu ideaUpdater, opt position.CreationOptions) (*position.Position, error) {
	p, err := position.New(ctx, mp, ps, opt)
	if err != nil {
		return nil, fmt.Errorf("couldn't create position (for idea id %v): %w", i.ID, err)
	}

	i.PositionIDs = append(i.PositionIDs, p.ID)

	if err := iu.Update(ctx, i); err != nil {
		i.PositionIDs = i.PositionIDs[:len(i.PositionIDs)-1]
		return nil, fmt.Errorf("couldn't update idea (id %v): %w", i.ID, err)
	}

	return p, nil
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
