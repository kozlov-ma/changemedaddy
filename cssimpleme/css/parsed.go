package css

import "cssimpleme/ast"

type parsed struct {
	Class    *Class
	Value    string
	Variants []ApplyVariant
}

func (p *parsed) ToRule() *ast.Rule {
	r := p.Class.Handle(p.Value)
	for _, apply := range p.Variants {
		r = apply(r)
	}

	return r
}

variant1:variant2:privet-privet-200
