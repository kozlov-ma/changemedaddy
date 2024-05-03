package idea

import (
	"changemedaddy/internal/domain/instrument"
	"changemedaddy/internal/domain/position"
	"context"
	"fmt"

	"github.com/gosimple/slug"
	"github.com/greatcloak/decimal"
)

type Status string

const (
	Active Status = "active"
	Closed Status = "closed"
)

type Idea struct {
	ID          int    `bson:"_id"`
	Name        string `bson:"name"`
	Slug        string `bson:"slug"`
	AuthorID    int    `bson:"author_id"`
	AuthorName  string `bson:"author_name"`
	AuthorSlug  string `bson:"author_slug"`
	SourceLink  string `bson:"source_link"`
	PositionIDs []int  `bson:"position_ids"`
	Status      Status `bson:"status"`
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
	Name       string
	AuthorName string
	AuthorSlug string
	AuthorID   int
	SourceLink string
}

func New(ctx context.Context, is ideaSaver, opt CreationOptions) (*Idea, error) {
	if len(opt.Name) < 3 {
		return nil, ErrNameTooShort
	} else if len(opt.Name) > 55 {
		return nil, ErrNameTooLong
	}

	i := &Idea{
		Name:       opt.Name,
		Slug:       slug.Make(opt.Name),
		AuthorSlug: opt.AuthorSlug,
		AuthorID:   opt.AuthorID,
		AuthorName: opt.AuthorName,
		SourceLink: opt.SourceLink,
		Status:     Active,
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

type positionUpdater interface {
	Update(ctx context.Context, p *position.Position) error
}

func (i *Idea) Close(ctx context.Context, mp marketProvider, pu positionUpdater) error {
	panic("need to implement")
}

type WithProfit struct {
	*Idea
	Positions []position.WithProfit
	ProfitP   decimal.Decimal
}

type priceProvider interface {
	Price(ctx context.Context, i *instrument.Instrument) (decimal.Decimal, error)
}

func (i *Idea) WithProfit(ctx context.Context, pp priceProvider) (WithProfit, error) {
	panic("need to implement in future")
}

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
