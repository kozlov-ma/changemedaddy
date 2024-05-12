package idearepo

import (
	"changemedaddy/internal/aggregate/idea"
	"context"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

const (
	dbName         = "ideax3"
	collectionName = "idea"
	queryTimeout   = time.Second
)

type mongoRepo struct {
	client *mongo.Client
	ideas  *mongo.Collection
}

func NewMongo(ctx context.Context, client *mongo.Client) *mongoRepo {
	collection := client.Database(dbName).Collection(collectionName)

	return &mongoRepo{
		client: client,
		ideas:  collection,
	}
}

func ideaFilter(i *idea.Idea) bson.D {
	return bson.D{{Key: "slug", Value: i.Slug}, {Key: "author_slug", Value: i.AuthorSlug}}
}

func (r *mongoRepo) Save(ctx context.Context, i *idea.Idea) error {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	sr := r.ideas.FindOne(ctx, ideaFilter(i))
	if sr.Err() == nil {
		return idea.ErrConflict
	} else if !errors.Is(sr.Err(), mongo.ErrNoDocuments) {
		return fmt.Errorf("couldn't verify that idea has unique slug: %w", sr.Err())
	}

	_, err := r.ideas.InsertOne(ctx, i)
	if err != nil {
		return fmt.Errorf("could't insert idea to repo: %w", err)
	}

	return nil
}

func (r *mongoRepo) Update(ctx context.Context, i *idea.Idea) error {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	sr := r.ideas.FindOneAndReplace(ctx, ideaFilter(i), i)

	if errors.Is(sr.Err(), mongo.ErrNoDocuments) {
		return idea.ErrNotFound
	} else if sr.Err() != nil {
		return fmt.Errorf("couldn't update idea: %w", sr.Err())
	}

	return nil
}

func (r *mongoRepo) FindBySlug(ctx context.Context, analystSlug, ideaSlug string) (*idea.Idea, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	i := new(idea.Idea)
	filter := bson.M{"author_slug": analystSlug, "slug": ideaSlug}
	err := r.ideas.FindOne(ctx, filter).Decode(i)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, idea.ErrNotFound
		}
		return nil, fmt.Errorf("could't find or decode idea: %w", err)
	}

	return i, nil
}

func (r *mongoRepo) FindByAnalystSlug(ctx context.Context, analystSlug string) ([]*idea.Idea, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	filter := bson.M{"author_slug": analystSlug}
	cur, err := r.ideas.Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("couldn't find ideas: %w", err)
	}

	var ii []*idea.Idea
	if err := cur.All(ctx, &ii); err != nil {
		return nil, fmt.Errorf("couldn't find ideas: %w", err)
	}

	return ii, nil
}
