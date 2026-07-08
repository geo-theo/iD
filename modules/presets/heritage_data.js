export const heritagePresetDefaultIDs = {
  area: [
    'heritage/cultural_site',
    'heritage/destroyed_building',
    'heritage/damage_event'
  ],
  line: [
    'heritage/cultural_site',
    'heritage/damage_event'
  ],
  point: [
    'heritage/cultural_site',
    'heritage/damage_event'
  ]
};


export const heritagePresetData = {
  fields: {
    'heritage/object_id': {
      key: 'heritage:object_id',
      type: 'identifier',
      overrideLabel: 'Heritage Object ID'
    },
    'heritage/site_type': {
      key: 'heritage:site_type',
      type: 'combo',
      overrideLabel: 'Heritage Site Type',
      autoSuggestions: false,
      options: [
        'mosque',
        'mausoleum',
        'tomb',
        'shrine',
        'library',
        'manuscript_library',
        'cemetery',
        'monument',
        'archaeological_site',
        'historic_building',
        'religious_site',
        'other'
      ]
    },
    'heritage/status': {
      key: 'heritage:status',
      type: 'combo',
      overrideLabel: 'Heritage Status',
      autoSuggestions: false,
      customValues: false,
      options: [
        'intact',
        'damaged',
        'destroyed',
        'removed',
        'unknown'
      ]
    },
    'heritage/damage_type': {
      key: 'heritage:damage_type',
      type: 'combo',
      overrideLabel: 'Damage Type',
      autoSuggestions: false,
      options: [
        'demolition',
        'burning',
        'shelling',
        'looting',
        'vandalism',
        'structural_collapse',
        'earthworks',
        'erosion',
        'unknown',
        'other'
      ]
    },
    'heritage/destruction_date': {
      key: 'heritage:destruction_date',
      type: 'date',
      overrideLabel: 'Destruction Date'
    },
    'heritage/destruction_start_date': {
      key: 'heritage:destruction_start_date',
      type: 'date',
      overrideLabel: 'Destruction Start Date'
    },
    'heritage/destruction_end_date': {
      key: 'heritage:destruction_end_date',
      type: 'date',
      overrideLabel: 'Destruction End Date'
    },
    'heritage/confidence': {
      key: 'heritage:confidence',
      type: 'radio',
      overrideLabel: 'Confidence',
      options: [
        'high',
        'medium',
        'low',
        'unknown'
      ]
    },
    'heritage/source_imagery': {
      key: 'source:imagery',
      type: 'semiCombo',
      overrideLabel: 'Source Imagery',
      snake_case: false,
      caseSensitive: true,
      autoSuggestions: false,
      options: [
        'Esri Wayback',
        'Bing',
        'Maxar',
        'Planet',
        'Sentinel-2',
        'Landsat',
        'Custom tile/WMS'
      ]
    },
    'heritage/source_imagery_date': {
      key: 'source:imagery:date',
      type: 'date',
      overrideLabel: 'Source Imagery Date'
    },
    'heritage/source_imagery_start_date': {
      key: 'source:imagery:start_date',
      type: 'date',
      overrideLabel: 'Source Imagery Start Date'
    },
    'heritage/source_imagery_end_date': {
      key: 'source:imagery:end_date',
      type: 'date',
      overrideLabel: 'Source Imagery End Date'
    },
    'heritage/evidence_note': {
      key: 'heritage:evidence',
      type: 'textarea',
      overrideLabel: 'Evidence Note'
    },
    'heritage/research_note': {
      key: 'research:note',
      type: 'textarea',
      overrideLabel: 'Research Note'
    }
  },

  presets: {
    'heritage/cultural_site': {
      name: 'Cultural Heritage Site',
      icon: 'maki-landmark',
      terms: [
        'heritage',
        'cultural heritage',
        'historic site',
        'monument',
        'tomb',
        'mosque',
        'mausoleum'
      ],
      fields: [
        'name',
        'heritage/object_id',
        'heritage/site_type',
        'heritage/status',
        'heritage/confidence',
        'heritage/source_imagery',
        'heritage/source_imagery_date',
        'heritage/evidence_note'
      ],
      moreFields: [
        'historic',
        'building',
        'religion',
        'denomination',
        'start_date',
        'wikidata',
        'wikipedia',
        'image',
        'description',
        'heritage/research_note'
      ],
      geometry: ['point', 'vertex', 'line', 'area'],
      tags: {
        'heritage:feature': 'site'
      },
      matchScore: 1.2
    },

    'heritage/destroyed_building': {
      name: 'Destroyed Heritage Building',
      icon: 'maki-building',
      terms: [
        'destroyed',
        'destruction',
        'damaged building',
        'heritage building',
        'ruins'
      ],
      fields: [
        'name',
        'heritage/object_id',
        'building',
        'heritage/site_type',
        'heritage/status',
        'heritage/damage_type',
        'heritage/destruction_date',
        'heritage/destruction_start_date',
        'heritage/destruction_end_date',
        'heritage/confidence',
        'heritage/source_imagery',
        'heritage/source_imagery_date',
        'heritage/evidence_note'
      ],
      moreFields: [
        'historic',
        'ruins',
        'wikidata',
        'wikipedia',
        'image',
        'description',
        'heritage/research_note'
      ],
      geometry: ['area'],
      tags: {
        building: '*',
        'heritage:status': 'destroyed'
      },
      addTags: {
        building: 'yes',
        'heritage:feature': 'building',
        'heritage:status': 'destroyed'
      },
      matchScore: 1.5
    },

    'heritage/damage_event': {
      name: 'Heritage Damage Event',
      icon: 'temaki-ruins',
      terms: [
        'damage event',
        'destruction event',
        'incident',
        'looting',
        'shelling',
        'demolition'
      ],
      fields: [
        'heritage/object_id',
        'heritage/damage_type',
        'heritage/destruction_date',
        'heritage/destruction_start_date',
        'heritage/destruction_end_date',
        'heritage/confidence',
        'heritage/source_imagery',
        'heritage/source_imagery_date',
        'heritage/source_imagery_start_date',
        'heritage/source_imagery_end_date',
        'heritage/evidence_note'
      ],
      moreFields: [
        'name',
        'description',
        'heritage/research_note'
      ],
      geometry: ['point', 'vertex', 'line', 'area'],
      tags: {
        'heritage:event': 'damage'
      },
      addTags: {
        'heritage:event': 'damage',
        'heritage:status': 'damaged'
      },
      matchScore: 1.2
    }
  }
};
