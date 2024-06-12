package css

import "cssimpleme/ast"

type parsed struct {
	Original string
	Class    *Class
	Value    string
	Variants []ApplyVariant
}

func (p *parsed) ToRule() *ast.Rule {
	r := ast.NewRule("."+Escape(p.Original), p.Class.Handle(p.Value)...)
	for _, apply := range p.Variants {
		r = apply(r)
	}

	return r
}
