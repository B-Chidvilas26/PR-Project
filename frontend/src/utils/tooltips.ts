export const GLOSSARY_TOOLTIPS: Record<string, { title: string; text: string }> = {
  bayesian_network: {
    title: 'Bayesian Network (BN)',
    text: 'A directed acyclic graph (DAG) where nodes represent case variables and arrows represent direct probabilistic dependencies learned from historical burglary records.',
  },
  posterior_probability: {
    title: 'Posterior Probability',
    text: 'The updated probability distribution of an unobserved variable after conditioning on all investigator-entered evidence in the network.',
  },
  evidence: {
    title: 'Evidence (Observed State)',
    text: 'A variable whose state has been observed or fixed by the investigator (clamped to 100%), propagating probability updates across connected nodes.',
  },
  entropy: {
    title: 'Shannon Entropy (Uncertainty)',
    text: 'Measures how spread out or uncertain a probability distribution is (in bits). Low entropy means one outcome dominates; high entropy means multiple outcomes remain similarly plausible.',
  },
  hmm: {
    title: 'Hidden Markov Model (HMM)',
    text: 'A temporal statistical model over sequential (month, 6-hour period) burglary counts that classifies regional burglary volume into latent activity regimes.',
  },
  hidden_state: {
    title: 'HMM Hidden State',
    text: 'An unobserved regional activity regime (State 0 = Low Activity, State 1 = Medium Activity, State 2 = High Activity) inferred from historical crime counts.',
  },
  gibbs_sampling: {
    title: 'Gibbs Sampling (MCMC)',
    text: 'An approximate Markov Chain Monte Carlo inference algorithm that repeatedly samples each unobserved variable given its Markov blanket, converging toward the exact posterior.',
  },
  markov_blanket: {
    title: 'Markov Blanket',
    text: "A node's parents, its children, and its children's other parents (spouses). Given its Markov blanket, a node is conditionally independent of all other variables in the network.",
  },
};
