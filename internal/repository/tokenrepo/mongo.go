package tokenrepo

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
	collectionName = "tokens"
	queryTimeout   = time.Second
)

type tokenRepo interface {
	SlugFromToken(ctx context.Context, token string) (string, error)
	RegisterAs(ctx context.Context, token, slug string) error
}

type mongoRepo struct {
	client *mongo.Client
	tok    *mongo.Collection
}

func NewMongo(ctx context.Context, client *mongo.Client) *mongoRepo {
	collection := client.Database(dbName).Collection(collectionName)
	return &mongoRepo{
		client: client,
		tok:    collection,
	}
}

type pair struct {
	Token string `bson:"token"`
	Slug  string `bson:"slug"`
}

func tokenFilter(token string) bson.D {
	return bson.D{{Key: "token", Value: token}}
}

func (r *mongoRepo) RegisterAs(ctx context.Context, token, slug string) error {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	sr := r.tok.FindOne(ctx, tokenFilter(token))
	if sr.Err() == nil {
		return analyst.ErrDuplicateToken
	} else if !errors.Is(sr.Err(), mongo.ErrNoDocuments) {
		return fmt.Errorf("couldn't verify that token is unique: %w", sr.Err())
	}

	_, err := r.tok.InsertOne(ctx, &pair{Token: token, Slug: slug})
	if err != nil {
		return fmt.Errorf("could't register token in repo: %w", err)
	}

	return nil
}

func (r *mongoRepo) SlugFromToken(ctx context.Context, token string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	p := new(pair)
	err := r.tok.FindOne(ctx, tokenFilter(token)).Decode(p)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return "", analyst.ErrNotFound
		}
		return "", fmt.Errorf("could't find or decode token pair: %w", err)
	}

	return p.Slug, nil
}
