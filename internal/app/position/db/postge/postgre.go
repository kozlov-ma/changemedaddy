package postge

import (
	"context"
	_ "database/sql"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"slices"

	"changemedaddy/internal/app/position"
)

type PostgreRep struct {
	db *sqlx.DB
}

func (r *PostgreRep) FindByID(ctx context.Context, analystSlug string, positionSlug string) (*position.Position, error) {
	var p position.Position
	tx := r.db.MustBegin()
	err := tx.Get(
		&p,
		`select * from positions pos 
    	join analysts anl on pos.analyst_id = anl.id 
         where pos.slug = $1 and anl.slug = $2`,
		positionSlug, analystSlug)
	if err != nil {
		return &p, err
	}

	var lots []position.Lot
	err = tx.Select(&lots,
		`select amount, created_at, price 
		from lots
		where position_id = $1
		order by created_at`,
		p.ID,
	)
	if err != nil {
		return &p, err
	}

	p.Lots = lots
	return &p, nil
}

func (r *PostgreRep) Create(ctx context.Context, p *position.Position) (cpy *position.Position, err error) {
	copied := *p // TODO зачем копировать
	cpy = &copied

	cpy.ID = p.CreatedByID + "-" + p.Slug
	cpy.Lots = slices.Clone(p.Lots)

	curAnalyst := analyst{}

	tx := r.db.MustBegin()
	err = tx.Get(&curAnalyst, `select * from analysts where slug=$1`, p.CreatedByID)
	if err != nil {
		return cpy, err
	}
	positionId, _ := tx.MustExec(
		`insert into positions (analyst_id, slug, ticker, type, target_price, created_at, deadline) values ($1, $2, $3, $4, $5, $6, $7)`,
		curAnalyst.Id, p.Slug, p.Ticker, p.Type, p.TargetPrice, p.CreatedAt, p.Deadline,
	).LastInsertId()
	for _, lot := range cpy.Lots {
		tx.MustExec(
			`insert into lots (position_id, amount, price) values ($1, $2, $3)`,
			positionId, lot.Amount, lot.Price,
		) // TODO created_at нужно заполнять
	}
	if err = tx.Commit(); err != nil {
		return cpy, err
	}

	return cpy, nil
}

func (r *PostgreRep) Update(ctx context.Context, p *position.Position) (*position.Position, error) {
	pos, err := r.FindByID(ctx, p.CreatedByID, p.Slug)
	if err != nil {
		return nil, err
	}

	tx := r.db.MustBegin()
	tx.MustExec(`delete from lots where position_id = $1`, pos.ID)
	for _, lot := range p.Lots {
		tx.MustExec(
			`insert into lots (position_id, amount, price) values ($1, $2, $3)`,
			pos.ID, lot.Amount, lot.Price,
		) // TODO created_at нужно заполнять
	}
	if err = tx.Commit(); err != nil {
		return pos, err
	}

	pos.Lots = slices.Clone(p.Lots)
	return pos, nil
}

func NewRepository() *PostgreRep {
	db, err := sqlx.Connect("postgres", "user=postgres dbname=demo password=5103 sslmode=disable")
	if err != nil {
		panic(err)
	}
	return &PostgreRep{db}
}
