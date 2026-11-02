declare module "@storybook/react" {
  export type Meta<T = any> = {
    title: string;
    component?: any;
    parameters?: Record<string, any>;
    tags?: string[];
  };
  export type StoryObj<T = any> = {
    args?: any;
    render?: (args: any) => any;
  };
}
