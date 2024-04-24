package idearepo

import (
	"changemedaddy/internal/domain/idea"
	"context"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"sync"
	"time"
)

const (
	connectionString = "mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.2.4"
	dbName           = "changemedaddy"
	collectionName   = "idea"
	queryTimeout     = 10 * time.Second
)

type MongoRep struct {
	mu    sync.RWMutex
	ideas *mongo.Collection
}

func NewMongoRep() *MongoRep {
	client, err := mongo.Connect(context.Background(), options.Client().ApplyURI(connectionString))
	if err != nil {
		panic(err)
	}
	collection := client.Database(dbName).Collection(collectionName)
	return &MongoRep{ideas: collection}
}

func (r *MongoRep) Create(ctx context.Context, idea *idea.Idea) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	ctxWithTimeout, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	_, err := r.ideas.InsertOne(ctxWithTimeout, idea)

	if err != nil {
		return ErrIdeaCreating
	}
	return nil
}

func (r *MongoRep) FindOne(ctx context.Context, analystSlug, ideaSlug string) (*idea.Idea, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	ctxWithTimeout, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	var idea idea.Idea
	filter := bson.M{"created_by_slug": analystSlug, "slug": ideaSlug}
	err := r.ideas.FindOne(ctxWithTimeout, filter).Decode(&idea)
	if err != nil {
		return nil, ErrIdeaFinding
	}
	return &idea, nil
}
