export type EventProps = {
  onWillAddFirstListener?: Function;
  onDidAddFirstListener?: Function;

  onDidAddListener?: Function;

  onWillRemoveListener?: Function;

  onDidRemoveLastListener?: Function;

  coldTrigger?: boolean;
};

export type EventListener = Function;
