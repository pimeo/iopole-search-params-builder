import { Builder, Ops } from './builder'


describe('io pole client  builder', () => {
  let builder

  beforeEach(() => {
    // Reset the builder before every test
    builder = new Builder()
  })

  test('validate builder query expressions', () => {
    const query = builder
      // 1. buyer.siren:"*123456789"
      .matches('buyer.siren', '*123456789')

      // 2. AND (buyer.corporateName:iopole OR seller.corporateName:"myOtherCompany")
      .or(qb => {
        qb.matches('buyer.corporateName', 'iopole')
        qb.matches('seller.corporateName', 'myOtherCompany')
      })

      // 3. AND createdDate:>="2024-01-01"
      .where('createdDate', Ops.GTE, '2024-01-01')

      // 4. AND createdDate:<="2025-01-01"
      .where('createdDate', Ops.LTE, '2025-01-01')
      .build()

    expect(query).toBe('buyer.siren:"*123456789" AND (buyer.corporateName:"iopole" OR seller.corporateName:"myOtherCompany") AND createdDate:>="2024-01-01" AND createdDate:<="2025-01-01"')
  })

  describe('Basic Expressions', () => {
    test('generates a simple string match with quotes', () => {
      builder.matches('status', 'active')
      expect(builder.build()).toBe('status:"active"')
    })

    test('generates a strict integer match using :=', () => {
      // "must be used in case of integer or boolean"
      builder.is('count', 10)
      expect(builder.build()).toBe('count:=10')
    })

    test('generates a strict boolean match using :=', () => {
      builder.is('isPublished', true)
      expect(builder.build()).toBe('isPublished:=true')
    })

    test('handles comparison operators (>=)', () => {
      builder.where('age', Ops.GTE, 18)
      expect(builder.build()).toBe('age:>=18')
    })

    test('handles date comparisons strings', () => {
      builder.where('createdDate', Ops.LTE, '2025-01-01')
      expect(builder.build()).toBe('createdDate:<="2025-01-01"')
    })

    test('does not add quotes to values containing wildcards (*)', () => {
      // "buyer.siren:*123" should not become "buyer.siren:"*123""
      builder.matches('buyer.siren', '*123456')
      expect(builder.build()).toBe('buyer.siren:"*123456"')
    })

    test('does not double-quote strings that are already quoted', () => {
      builder.matches('company', '"MyCompany"')
      expect(builder.build()).toBe('company:"MyCompany"')
    })
  })

  describe('Complex & Nested Logic', () => {
    test('joins multiple root conditions with AND by default', () => {
      builder
        .matches('firstName', 'John')
        .matches('lastName', 'Doe')

      expect(builder.build()).toBe('firstName:"John" AND lastName:"Doe"')
    })

    test('creates a grouped OR condition', () => {
      builder
        .matches('status', 'active')
        .or(sub => {
          sub.matches('role', 'admin')
          sub.matches('role', 'editor')
        })

      // Expect parentheses around the OR group
      expect(builder.build()).toBe('status:"active" AND (role:"admin" OR role:"editor")')
    })

    test('handles the specific complex scenario from requirements', () => {
      /**
         * Requirement:
         * buyer.siren:"*123456789"
         * AND (buyer.corporateName:iopole OR seller.corporateName:"myOtherCompany")
         * AND createdDate:>="2024-01-01"
         * AND createdDate:<="2025-01-01"
         */

      builder
        .matches('buyer.siren', '*123456789')
        .or(qb => {
          qb.matches('buyer.corporateName', 'iopole')
          qb.matches('seller.corporateName', 'myOtherCompany')
        })
        .where('createdDate', Ops.GTE, '2024-01-01')
        .where('createdDate', Ops.LTE, '2025-01-01')

      const result = builder.build()

      expect(result).toBe(
        'buyer.siren:"*123456789" AND (buyer.corporateName:"iopole" OR seller.corporateName:"myOtherCompany") AND createdDate:>="2024-01-01" AND createdDate:<="2025-01-01"'
      )
    })

    test('handles deeply nested groups (AND inside OR)', () => {
      // (status:active OR (age:>=18 AND country:FR))
      builder.or(rootOr => {
        rootOr.matches('status', 'active')

        rootOr.and(subAnd => {
          subAnd.where('age', Ops.GTE, 18)
          subAnd.matches('country', 'FR')
        })
      })

      expect(builder.build()).toBe('status:"active" OR (age:>=18 AND country:"FR")')
    })
  })

  describe('Edge Cases', () => {
    test('returns an empty string if no conditions are added', () => {
      expect(builder.build()).toBe('')
    })

    test('single item in a group should not usually have parentheses (optional optimization check)', () => {
      // If you implemented the logic to strip parens for single items:
      builder.or(sub => {
        sub.matches('id', 1)
      })

      // Depending on implementation, this might be (id:=1) or just id:=1
      // If using the logic I provided previously, it will be just id:=1 because it's the root,
      // but strictly inside a group usually implies parens.
      // Let's assume strict grouping behavior:
      expect(builder.build()).toBe('id:=1')
    })
  })

  describe('Between Expressions', () => {
    test('generates an included range expression match without quotes', () => {
      builder.between('amount', 10, 20)
      expect(builder.build()).toBe('amount:[10 TO 20]')
    })

    test('generates an included range expression match with quotes', () => {
      builder.between('amount', '2025-01-01', '2025-01-31')
      expect(builder.build()).toBe('amount:["2025-01-01" TO "2025-01-31"]')
    })

    test('generates an excluded range expression match without quotes', () => {
      builder.strictBetween('amount', 10, 20)
      expect(builder.build()).toBe('amount:{10 TO 20}')
    })

    test('generates an excluded range expression match with quotes', () => {
      builder.strictBetween('amount', '2025-01-01', '2025-01-31')
      expect(builder.build()).toBe('amount:{"2025-01-01" TO "2025-01-31"}')
    })
  })

  describe('Unary Expressions', () => {
    test('generates an complexe unary expression', () => {
      builder
        .orNot(qb => {
          qb.matches('name', 'myName')
          qb.and(subQb => {
            subQb.matches('amount', 100)
            subQb.matches('name', 'myOtherName')
          })
        })

      expect(builder.build()).toBe('name:"myName" OR NOT (amount:=100 AND name:"myOtherName")')
    })
  })
})
