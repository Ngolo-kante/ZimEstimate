// Single source of truth for contractor trades and service areas.
//
// The registration form and the directory filter must read the same lists. They
// were briefly built against different vocabularies — registration offered
// "Bricklaying", "Solar" and "General building" while the filter offered
// "Brickwork", "Solar installation" and "General contractor" — so a contractor
// could register with a trade no filter would ever match. Only 6 of 13 terms
// overlapped. Change these lists here and nowhere else.

export const CONTRACTOR_TRADES = [
  'General contractor',
  'Brickwork',
  'Carpentry',
  'Electrical',
  'Plumbing',
  'Roofing',
  'Painting',
  'Tiling',
  'Ceilings',
  'Flooring',
  'Welding',
  'Solar installation',
  'Borehole installation',
  'Paving',
  'Quantity surveying',
];

export const ZIMBABWE_SERVICE_AREAS = [
  'Harare',
  'Bulawayo',
  'Chitungwiza',
  'Mutare',
  'Gweru',
  'Kwekwe',
  'Kadoma',
  'Masvingo',
  'Chinhoyi',
  'Marondera',
  'Norton',
  'Ruwa',
  'Victoria Falls',
  'Zvishavane',
  'Bindura',
];
