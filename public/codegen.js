let template_cache = null;

async function loadTemplate() {
  try {
    const response = await fetch("/codegen_template.luau");
    if (!response.ok) {
      throw new Error("HTTP error, status = " + response.status);
    }

    const text = await response.text();
    template_cache = text;
    return text;
  } catch (e) {
    console.error("Failed to load template", err);
  }
}

function fix(num) {
  return Math.round(num * 1000) / 1000;
}

export default class CodeGen {
  constructor() {
    this.gen = "";
    this.stream = [];
    this.dead = false;
  }

  process(cuboids) {
    if (this.dead) return;
    for (let i = 0; i < cuboids.length; i++) {
      const cuboid = cuboids[i];

      // position vector (3)
      this.stream.push(fix(cuboid.position.x));
      this.stream.push(fix(cuboid.position.y));
      this.stream.push(fix(cuboid.position.z));

      // rotation quaternion (4)
      this.stream.push(fix(cuboid.rotation.x));
      this.stream.push(fix(cuboid.rotation.y));
      this.stream.push(fix(cuboid.rotation.z));
      this.stream.push(fix(cuboid.rotation.w));

      // size vector (3)
      this.stream.push(fix(cuboid.size.x));
      this.stream.push(fix(cuboid.size.y));
      this.stream.push(fix(cuboid.size.z));
    }

    // length must equal a multiple of 7 otherwise the data is corrupted
    if (this.stream.length % 10 !== 0)
      throw new Error(
        `corrupted codegen stream: ${this.stream.length} is not a multiple of 10`,
      );
  }

  generate() {
    if (this.dead) return;
    this.dead = true;
    this.gen = `{ ${this.stream.join()} }`;
  }

  async emit() {
    let template = template_cache;
    if (!template) {
      template = await loadTemplate();
    }
    template_cache = template;
    return template.replace("CODEGEN_INJECTED", this.gen);
  }
}
