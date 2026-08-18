import { Resources } from "../types";
export type LocalizeFunc = (key: string, ...args: any[]) => string;
interface FormatType {
    [format: string]: any;
}
export interface FormatsType {
    number: FormatType;
    date: FormatType;
    time: FormatType;
}
/**
 * Adapted from Polymer app-localize-behavior.
 *
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
export declare const computeLocalize: (cache: any, language: string, resources: Resources, formats?: FormatsType) => Promise<LocalizeFunc>;
export {};
