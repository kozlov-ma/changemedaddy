package ast

type Node interface {
	tagNode()
}

type Rule struct {
	Selector string
	Nodes    []Node
}

type Declaration struct {
	Property, Value string
}

func (r *Rule) tagNode()        {}
func (d *Declaration) tagNode() {}

func Decl(property, value string) *Declaration {
	return &Declaration{
		Property: property,
		Value:    value,
	}
}
