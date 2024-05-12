package analystrepo

import (
	"changemedaddy/internal/aggregate/analyst"
	"context"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

const (
	dbName         = "ideax3"
	collectionName = "analyst"
	queryTimeout   = time.Second
)

type analystRepo interface {
	Save(ctx context.Context, a *analyst.Analyst) error
	FindBySlug(ctx context.Context, slug string) (*analyst.Analyst, error)
}

type mongoRepo struct {
	client *mongo.Client
	aa     *mongo.Collection
}

func NewMongo(ctx context.Context, client *mongo.Client) *mongoRepo {
	collection := client.Database(dbName).Collection(collectionName)

	return &mongoRepo{
		client: client,
		aa:     collection,
	}
}

func analystFilter(slug string) bson.D {
	return bson.D{{Key: "slug", Value: slug}}
}

func (r *mongoRepo) Save(ctx context.Context, a *analyst.Analyst) error {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	sr := r.aa.FindOne(ctx, analystFilter(a.Slug))
	if sr.Err() == nil {
		return analyst.ErrDuplicateName
	} else if !errors.Is(sr.Err(), mongo.ErrNoDocuments) {
		return fmt.Errorf("couldn't verify that analyst has unique slug: %w", sr.Err())
	}

	_, err := r.aa.InsertOne(ctx, a)
	if err != nil {
		return fmt.Errorf("could't insert analyst to repo: %w", err)
	}

	return nil
}

func (r *mongoRepo) FindBySlug(ctx context.Context, slug string) (*analyst.Analyst, error) {
	sr := r.aa.FindOne(ctx, analystFilter(slug))
	if sr.Err() == nil {
		a := new(analyst.Analyst)
		err := sr.Decode(a)
		if err != nil {
			return nil, fmt.Errorf("couldn't decode analyst: %w", err)
		}

		return a, nil
	} else if errors.Is(sr.Err(), mongo.ErrNoDocuments) {
		return nil, analyst.ErrNotFound
	} else {
		return nil, fmt.Errorf("couldn't find analyst: %w", sr.Err())
	}
}
