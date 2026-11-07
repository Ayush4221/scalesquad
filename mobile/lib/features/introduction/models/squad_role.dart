enum SquadRole {
  traffic(
    'Traffic',
    'Read the surge.',
    'Understand incoming demand and the retries that can turn a busy entrance into a bottleneck.',
  ),
  data(
    'Data',
    'Protect every pass.',
    'Think about identity and consistency. One valid pass should mean one admission.',
  ),
  operations(
    'Operations',
    'Keep the system moving.',
    'Balance capacity, reliability and budget. A repair needs to hold up under pressure.',
  );

  const SquadRole(this.label, this.heading, this.description);
  final String label;
  final String heading;
  final String description;
}
