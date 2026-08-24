declare module "mapshaper" {
  const mapshaper: {
    runCommands(commands: string | string[]): Promise<void>;
  };

  export default mapshaper;
}
