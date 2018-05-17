var nevir_conf = {
  "sparql_endpoint": "http://localhost:8080/index/coci/sparql",

  "prefixes": [
      {"prefix":"cito","iri":"http://purl.org/spar/cito/"},
      {"prefix":"dcterms","iri":"http://purl.org/dc/terms/"},
      {"prefix":"datacite","iri":"http://purl.org/spar/datacite/"},
      {"prefix":"literal","iri":"http://www.essepuntato.it/2010/06/literalreification/"},
      {"prefix":"biro","iri":"http://purl.org/spar/biro/"},
      {"prefix":"frbr","iri":"http://purl.org/vocab/frbr/core#"},
      {"prefix":"c4o","iri":"http://purl.org/spar/c4o/"},
      {"prefix":"bds","iri":"http://www.bigdata.com/rdf/search#"},
      {"prefix":"fabio","iri":"http://purl.org/spar/fabio/"},
      {"prefix":"pro","iri":"http://purl.org/spar/pro/"},
      {"prefix":"rdf","iri":"http://www.w3.org/1999/02/22-rdf-syntax-ns#"}
    ],

  "categories":{
    "citation": {
      "rule": "ci\/.*",
      "title": "Citations",

      "left_depth": 2,
      "right_depth": 1,

      "node": {
          "query": [
            "SELECT DISTINCT ?id ?iri ?short_iri ?shorter_coci ?citing_doi ?citing_doi_iri ?cited_doi ?cited_doi_iri ?creationdate ?timespan",
                "WHERE  {",
                  "BIND('[[VAR]]' as ?id) .",
                  "BIND(<https://w3id.org/oc/index/coci/[[VAR]]> as ?iri) .",
                  "OPTIONAL {",
                    "BIND(REPLACE(STR(?iri), 'https://w3id.org/oc/index/coci/ci/', '', 'i') as ?short_iri) .",
                    "?iri cito:hasCitingEntity ?citing_doi_iri .",
                    "BIND(REPLACE(STR(?citing_doi_iri), 'http://dx.doi.org/', '', 'i') as ?citing_doi) .",
                    "?iri cito:hasCitedEntity ?cited_doi_iri .",
                    "BIND(REPLACE(STR(?cited_doi_iri), 'http://dx.doi.org/', '', 'i') as ?cited_doi) .",
                    "?iri cito:hasCitationCreationDate ?creationdate .",
                    "?iri cito:hasCitationTimeSpan ?timespan .",
                  "}",
                "}"
          ],
          "id": "id",
          "value": "timespan",
          "label": {"fields": ["FREE-TEXT","short_iri"], "values": ["A citation: ",null]},
          "fields": [
            {
              "id":"short_iri",
              "value":"query.short_iri",
              "type": "text"
            },
            {
              "id":"citing_doi",
              "value":"query.citing_doi",
              "type": "text"
            },
            {
              "id":"cited_doi",
              "value":"query.cited_doi",
              "type": "text"
            },
            {
              "id":"creationdate",
              "value":"query.creationdate",
              "type": "text"
            },
            {
              "id":"timespan",
              "value":"query.timespan",
              "type": "text"
            }
          ]
      },
      "edge": {
        "query": [
          "SELECT ?id ?from ?to WHERE  {",
                "{?iri cito:hasCitedEntity <[[node.citing_doi_iri]]> .}",
                "UNION",
                "{?iri cito:hasCitingEntity <[[node.cited_doi_iri]]> .}",
                "BIND(REPLACE(STR(?iri), 'https://w3id.org/oc/index/coci/', '', 'i') as ?from) .",
                "BIND('ci/[[node.short_iri]]' as ?to) .",
                "BIND(CONCAT(?from, '->', ?to)  as ?id) .",
              "}"
        ],
        "id": "id",
        "label": {"fields": ["from","FREE-TEXT","to"], "values": [null," -> ",null]},
        "from": "from",
        "to": "to"
      }
    }
  }

}
