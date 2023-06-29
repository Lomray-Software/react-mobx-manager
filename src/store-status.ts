enum StoreStatus {
  init = 'init', // created, but never used and was not passed to the children components
  touched = 'touched', // store was passed to the children component
  inUse = 'in-use',
  unused = 'unused',
}

export default StoreStatus;
