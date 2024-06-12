package ast

import "strings"

const indentation = "  "

type Node interface {
	writeCSS(sb *strings.Builder, indent int)
}

type Rule struct {
	Selector string
	Nodes    []Node
}

type Declaration struct {
	Property, Value string
}

func (r *Rule) writeCSS(sb *strings.Builder, indent int) {
	for range indent {
		sb.WriteString(indentation)
	}

	sb.WriteString(r.Selector)
	sb.WriteString(" {\n")

	for _, node := range r.Nodes {
		node.writeCSS(sb, indent+1)
	}

	for range indent {
		sb.WriteString(indentation)
	}

	sb.WriteRune('}')
}

func (d *Declaration) writeCSS(sb *strings.Builder, indent int) {
	for range indent {
		sb.WriteString(indentation)
	}

	sb.WriteString(d.Property)
	sb.WriteString(": ")
	sb.WriteString(d.Value)

	sb.WriteString(";\n")
}

func Decl(property, value string) *Declaration {
	return &Declaration{
		Property: property,
		Value:    value,
	}
}

func (r *Rule) CSS() string {
	var sb strings.Builder
	r.writeCSS(&sb, 0)

	return sb.String()
}

func NewRule(selector string, nodes ...Node) *Rule {
	return &Rule{
		Selector: selector,
		Nodes:    nodes,
	}
}
