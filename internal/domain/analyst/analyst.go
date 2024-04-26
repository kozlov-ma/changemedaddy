package analyst

type Analyst struct {
	ID   int    `bson:"id"`
	Slug string `bson:"slug"`
	Name string `bson:"name"`
}
