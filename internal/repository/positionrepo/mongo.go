package positionrepo

import (
	"changemedaddy/internal/domain/instrument"
	"changemedaddy/internal/domain/position"
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/greatcloak/decimal"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

const (
	dbName         = "ideax3"
	collectionName = "position"
	queryTimeout   = time.Second
)

type positionRepo interface {
	Save(ctx context.Context, p *position.Position) error
	Find(ctx context.Context, id int) (*position.Position, error)
	Update(ctx context.Context, p *position.Position) error
}

type priceProvider interface {
	Price(ctx context.Context, i *instrument.Instrument) (decimal.Decimal, error)
}

type mongoRepo struct {
	client *mongo.Client
	pp     *mongo.Collection
}

func NewMongo(ctx context.Context, client *mongo.Client) *mongoRepo {
	collection := client.Database(dbName).Collection(collectionName)
	return &mongoRepo{
		client: client,
		pp:     collection,
	}
}

func positionFilter(id int) bson.D {
	return bson.D{{Key: "id", Value: id}}
}

func (r *mongoRepo) Save(ctx context.Context, p *position.Position) error {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	sr := r.pp.FindOne(ctx, positionFilter(p.ID))
	if sr.Err() == nil {
		return position.ErrConflict
	} else if !errors.Is(sr.Err(), mongo.ErrNoDocuments) {
		return fmt.Errorf("couldn't verify that position has unique id: %w", sr.Err())
	}

	_, err := r.pp.InsertOne(ctx, p)
	if err != nil {
		return fmt.Errorf("could't insert position to repo: %w", err)
	}

	return nil
}

func (r *mongoRepo) Update(ctx context.Context, p *position.Position) error {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	sr := r.pp.FindOneAndReplace(ctx, positionFilter(p.ID), p)

	if errors.Is(sr.Err(), mongo.ErrNoDocuments) {
		return position.ErrNotFound
	} else if sr.Err() != nil {
		return fmt.Errorf("couldn't update position: %w", sr.Err())
	}

	return nil
}

func (r *mongoRepo) Find(ctx context.Context, id int) (*position.Position, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	p := new(position.Position)
	err := r.pp.FindOne(ctx, positionFilter(id)).Decode(p)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, position.ErrNotFound
		}
		return nil, fmt.Errorf("could't find or decode position: %w", err)
	}

	return p, nil
}
