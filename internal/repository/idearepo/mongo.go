package idearepo

import (
	"changemedaddy/internal/aggregate/idea"
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	connectionString = "mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.2.4"
	dbName           = "changemedaddy"
	collectionName   = "idea"
	queryTimeout     = time.Second
)

type mongoRepo struct {
	ideas *mongo.Collection
}

func NewMongoRepo(ctx context.Context) *mongoRepo {
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(connectionString))
	if err != nil {
		panic(err)
	}
	collection := client.Database(dbName).Collection(collectionName)

	indexOptions := options.Index().SetUnique(true)
	keys := bson.D{{Key: "created_by_slug", Value: 1}, {Key: "slug", Value: 1}}

	indexModel := mongo.IndexModel{
		Keys:    keys,
		Options: indexOptions,
	}

	_, err = collection.Indexes().CreateOne(ctx, indexModel)
	if err != nil {
		panic(err)
	}

	return &mongoRepo{ideas: collection}
}

func (r *mongoRepo) Create(ctx context.Context, idea *idea.Idea) error {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	_, err := r.ideas.InsertOne(ctx, idea)

	if err != nil {
		return fmt.Errorf("could't insert the idea to repo: %w", err)
	}
	return nil
}

func (r *mongoRepo) FindOne(ctx context.Context, analystSlug, ideaSlug string) (*idea.Idea, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	var idea idea.Idea
	filter := bson.M{"created_by_slug": analystSlug, "slug": ideaSlug}
	err := r.ideas.FindOne(ctx, filter).Decode(&idea)
	if err != nil {
		return nil, fmt.Errorf("could't find one idea: %w", err)
	}
	return &idea, nil
}
