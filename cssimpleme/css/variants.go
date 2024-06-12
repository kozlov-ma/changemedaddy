package css

import (
	"cssimpleme/ast"
	"sync"
	"sync/atomic"
)

type Variants struct {
	registrationComplete atomic.Bool
	mu                   sync.Mutex
	vv                   map[string]ApplyVariant
}

func NewVariants() *Variants {
	return &Variants{
		vv: make(map[string]ApplyVariant, 10),
	}
}

func (v *Variants) Find(name string) (av ApplyVariant, ok bool) {
	v.registrationComplete.Store(true)
	av, ok = v.vv[name]
	return av, ok
}

func (c *Variants) PseudoClass(name string) {
	if c.registrationComplete.Load() {
		panic("cannot register new variants after reading")
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	c.vv[name] = func(r *ast.Rule) *ast.Rule {
		new := &ast.Rule{
			Selector: name + "\\:" + r.Selector + ":" + name,
			Nodes:    r.Nodes,
		}

		return new
	}
}

func (c *Variants) Selector(name string, selector string) {
	if c.registrationComplete.Load() {
		panic("cannot register new variants after reading")
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	c.vv[name] = func(r *ast.Rule) *ast.Rule {
		new := &ast.Rule{
			Selector: selector,
			Nodes: []ast.Node{
				ast.NewRule(name+"\\:"+r.Selector, r.Nodes...), // FIXME сломается на вложенных lg:md ...
			},
		}

		return new
	}
}
