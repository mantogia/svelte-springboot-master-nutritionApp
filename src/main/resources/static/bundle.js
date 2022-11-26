var app = (function () {
	'use strict';

	function noop() {}

	function assign(tar, src) {
		for (const k in src) tar[k] = src[k];
		return tar;
	}

	function is_promise(value) {
		return value && typeof value.then === 'function';
	}

	function add_location(element, file, line, column, char) {
		element.__svelte_meta = {
			loc: { file, line, column, char }
		};
	}

	function run(fn) {
		return fn();
	}

	function blank_object() {
		return Object.create(null);
	}

	function run_all(fns) {
		fns.forEach(run);
	}

	function is_function(thing) {
		return typeof thing === 'function';
	}

	function safe_not_equal(a, b) {
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}

	function create_slot(definition, ctx, fn) {
		if (definition) {
			const slot_ctx = get_slot_context(definition, ctx, fn);
			return definition[0](slot_ctx);
		}
	}

	function get_slot_context(definition, ctx, fn) {
		return definition[1]
			? assign({}, assign(ctx.$$scope.ctx, definition[1](fn ? fn(ctx) : {})))
			: ctx.$$scope.ctx;
	}

	function get_slot_changes(definition, ctx, changed, fn) {
		return definition[1]
			? assign({}, assign(ctx.$$scope.changed || {}, definition[1](fn ? fn(changed) : {})))
			: ctx.$$scope.changed || {};
	}

	function append(target, node) {
		target.appendChild(node);
	}

	function insert(target, node, anchor) {
		target.insertBefore(node, anchor);
	}

	function detach(node) {
		node.parentNode.removeChild(node);
	}

	function destroy_each(iterations, detaching) {
		for (let i = 0; i < iterations.length; i += 1) {
			if (iterations[i]) iterations[i].d(detaching);
		}
	}

	function element(name) {
		return document.createElement(name);
	}

	function text(data) {
		return document.createTextNode(data);
	}

	function space() {
		return text(' ');
	}

	function empty() {
		return text('');
	}

	function listen(node, event, handler, options) {
		node.addEventListener(event, handler, options);
		return () => node.removeEventListener(event, handler, options);
	}

	function attr(node, attribute, value) {
		if (value == null) node.removeAttribute(attribute);
		else node.setAttribute(attribute, value);
	}

	function children(element) {
		return Array.from(element.childNodes);
	}

	function set_data(text, data) {
		data = '' + data;
		if (text.data !== data) text.data = data;
	}

	function set_style(node, key, value) {
		node.style.setProperty(key, value);
	}

	function custom_event(type, detail) {
		const e = document.createEvent('CustomEvent');
		e.initCustomEvent(type, false, false, detail);
		return e;
	}

	let current_component;

	function set_current_component(component) {
		current_component = component;
	}

	function get_current_component() {
		if (!current_component) throw new Error(`Function called outside component initialization`);
		return current_component;
	}

	function onMount(fn) {
		get_current_component().$$.on_mount.push(fn);
	}

	function createEventDispatcher() {
		const component = current_component;

		return (type, detail) => {
			const callbacks = component.$$.callbacks[type];

			if (callbacks) {
				// TODO are there situations where events could be dispatched
				// in a server (non-DOM) environment?
				const event = custom_event(type, detail);
				callbacks.slice().forEach(fn => {
					fn.call(component, event);
				});
			}
		};
	}

	const dirty_components = [];

	const resolved_promise = Promise.resolve();
	let update_scheduled = false;
	const binding_callbacks = [];
	const render_callbacks = [];
	const flush_callbacks = [];

	function schedule_update() {
		if (!update_scheduled) {
			update_scheduled = true;
			resolved_promise.then(flush);
		}
	}

	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}

	function flush() {
		const seen_callbacks = new Set();

		do {
			// first, call beforeUpdate functions
			// and update components
			while (dirty_components.length) {
				const component = dirty_components.shift();
				set_current_component(component);
				update(component.$$);
			}

			while (binding_callbacks.length) binding_callbacks.shift()();

			// then, once components are updated, call
			// afterUpdate functions. This may cause
			// subsequent updates...
			while (render_callbacks.length) {
				const callback = render_callbacks.pop();
				if (!seen_callbacks.has(callback)) {
					callback();

					// ...so guard against infinite loops
					seen_callbacks.add(callback);
				}
			}
		} while (dirty_components.length);

		while (flush_callbacks.length) {
			flush_callbacks.pop()();
		}

		update_scheduled = false;
	}

	function update($$) {
		if ($$.fragment) {
			$$.update($$.dirty);
			run_all($$.before_render);
			$$.fragment.p($$.dirty, $$.ctx);
			$$.dirty = null;

			$$.after_render.forEach(add_render_callback);
		}
	}

	let outros;

	function group_outros() {
		outros = {
			remaining: 0,
			callbacks: []
		};
	}

	function check_outros() {
		if (!outros.remaining) {
			run_all(outros.callbacks);
		}
	}

	function on_outro(callback) {
		outros.callbacks.push(callback);
	}

	function handle_promise(promise, info) {
		const token = info.token = {};

		function update(type, index, key, value) {
			if (info.token !== token) return;

			info.resolved = key && { [key]: value };

			const child_ctx = assign(assign({}, info.ctx), info.resolved);
			const block = type && (info.current = type)(child_ctx);

			if (info.block) {
				if (info.blocks) {
					info.blocks.forEach((block, i) => {
						if (i !== index && block) {
							group_outros();
							on_outro(() => {
								block.d(1);
								info.blocks[i] = null;
							});
							block.o(1);
							check_outros();
						}
					});
				} else {
					info.block.d(1);
				}

				block.c();
				if (block.i) block.i(1);
				block.m(info.mount(), info.anchor);

				flush();
			}

			info.block = block;
			if (info.blocks) info.blocks[index] = block;
		}

		if (is_promise(promise)) {
			promise.then(value => {
				update(info.then, 1, info.value, value);
			}, error => {
				update(info.catch, 2, info.error, error);
			});

			// if we previously had a then/catch block, destroy it
			if (info.current !== info.pending) {
				update(info.pending, 0);
				return true;
			}
		} else {
			if (info.current !== info.then) {
				update(info.then, 1, info.value, promise);
				return true;
			}

			info.resolved = { [info.value]: promise };
		}
	}

	function mount_component(component, target, anchor) {
		const { fragment, on_mount, on_destroy, after_render } = component.$$;

		fragment.m(target, anchor);

		// onMount happens after the initial afterUpdate. Because
		// afterUpdate callbacks happen in reverse order (inner first)
		// we schedule onMount callbacks before afterUpdate callbacks
		add_render_callback(() => {
			const new_on_destroy = on_mount.map(run).filter(is_function);
			if (on_destroy) {
				on_destroy.push(...new_on_destroy);
			} else {
				// Edge case - component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(new_on_destroy);
			}
			component.$$.on_mount = [];
		});

		after_render.forEach(add_render_callback);
	}

	function destroy(component, detaching) {
		if (component.$$) {
			run_all(component.$$.on_destroy);
			component.$$.fragment.d(detaching);

			// TODO null out other refs, including component.$$ (but need to
			// preserve final state?)
			component.$$.on_destroy = component.$$.fragment = null;
			component.$$.ctx = {};
		}
	}

	function make_dirty(component, key) {
		if (!component.$$.dirty) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty = {};
		}
		component.$$.dirty[key] = true;
	}

	function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
		const parent_component = current_component;
		set_current_component(component);

		const props = options.props || {};

		const $$ = component.$$ = {
			fragment: null,
			ctx: null,

			// state
			props: prop_names,
			update: noop,
			not_equal: not_equal$$1,
			bound: blank_object(),

			// lifecycle
			on_mount: [],
			on_destroy: [],
			before_render: [],
			after_render: [],
			context: new Map(parent_component ? parent_component.$$.context : []),

			// everything else
			callbacks: blank_object(),
			dirty: null
		};

		let ready = false;

		$$.ctx = instance
			? instance(component, props, (key, value) => {
				if ($$.ctx && not_equal$$1($$.ctx[key], $$.ctx[key] = value)) {
					if ($$.bound[key]) $$.bound[key](value);
					if (ready) make_dirty(component, key);
				}
			})
			: props;

		$$.update();
		ready = true;
		run_all($$.before_render);
		$$.fragment = create_fragment($$.ctx);

		if (options.target) {
			if (options.hydrate) {
				$$.fragment.l(children(options.target));
			} else {
				$$.fragment.c();
			}

			if (options.intro && component.$$.fragment.i) component.$$.fragment.i();
			mount_component(component, options.target, options.anchor);
			flush();
		}

		set_current_component(parent_component);
	}

	class SvelteComponent {
		$destroy() {
			destroy(this, true);
			this.$destroy = noop;
		}

		$on(type, callback) {
			const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
			callbacks.push(callback);

			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		$set() {
			// overridden by instance, if it has props
		}
	}

	class SvelteComponentDev extends SvelteComponent {
		constructor(options) {
			if (!options || (!options.target && !options.$$inline)) {
				throw new Error(`'target' is a required option`);
			}

			super();
		}

		$destroy() {
			super.$destroy();
			this.$destroy = () => {
				console.warn(`Component was already destroyed`); // eslint-disable-line no-console
			};
		}
	}

	function writable(value, start = noop) {
		let stop;
		const subscribers = [];

		function set(new_value) {
			if (safe_not_equal(value, new_value)) {
				value = new_value;
				if (!stop) return; // not ready
				subscribers.forEach(s => s[1]());
				subscribers.forEach(s => s[0](value));
			}
		}

		function update(fn) {
			set(fn(value));
		}

		function subscribe(run, invalidate = noop) {
			const subscriber = [run, invalidate];
			subscribers.push(subscriber);
			if (subscribers.length === 1) stop = start(set) || noop;
			run(value);

			return () => {
				const index = subscribers.indexOf(subscriber);
				if (index !== -1) subscribers.splice(index, 1);
				if (subscribers.length === 0) stop();
			};
		}

		return { set, update, subscribe };
	}

	const hash = writable('');

	hashSetter();

	window.onhashchange = () => hashSetter();

	function hashSetter() {
	  hash.set(
	    location.hash.length >= 2 
	    ? location.hash.substring(2) 
	    : ''
	  );
	}

	/* src\app\component\FoodComponent.svelte generated by Svelte v3.1.0 */

	const file = "src\\app\\component\\FoodComponent.svelte";

	function create_fragment(ctx) {
		var div1, img, img_src_value, t0, div0, button0, t2, button1, t4, button2, dispose;

		return {
			c: function create() {
				div1 = element("div");
				img = element("img");
				t0 = space();
				div0 = element("div");
				button0 = element("button");
				button0.textContent = "dislike";
				t2 = space();
				button1 = element("button");
				button1.textContent = "like";
				t4 = space();
				button2 = element("button");
				button2.textContent = "superlike";
				img.src = img_src_value = "./images/" + ctx.food_nr + ".jpg";
				img.className = "card-img-top svelte-14wmfk2";
				img.alt = "Hier kommt das Bild hin";
				add_location(img, file, 38, 4, 757);
				button0.className = "btn btn-primary";
				add_location(button0, file, 41, 6, 881);
				button1.className = "btn btn-primary";
				add_location(button1, file, 42, 6, 968);
				button2.className = "btn btn-primary";
				add_location(button2, file, 43, 6, 1052);
				div0.className = "card-body svelte-14wmfk2";
				add_location(div0, file, 39, 4, 848);
				div1.className = "card svelte-14wmfk2";
				set_style(div1, "width", "18rem");
				add_location(div1, file, 37, 0, 711);

				dispose = [
					listen(button0, "click", ctx.click_handler),
					listen(button1, "click", ctx.click_handler_1),
					listen(button2, "click", ctx.click_handler_2)
				];
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div1, anchor);
				append(div1, img);
				append(div1, t0);
				append(div1, div0);
				append(div0, button0);
				append(div0, t2);
				append(div0, button1);
				append(div0, t4);
				append(div0, button2);
			},

			p: function update_1(changed, ctx) {
				if ((changed.food_nr) && img_src_value !== (img_src_value = "./images/" + ctx.food_nr + ".jpg")) {
					img.src = img_src_value;
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div1);
				}

				run_all(dispose);
			}
		};
	}

	function instance($$self, $$props, $$invalidate) {
		

	    const dispatch = createEventDispatcher();

	    let { food_nr } = $$props;

	    let food = {};
	    let { onChange } = $$props;
	    
	    onMount(() => update());

	    function update(){
	        axios.get("/foods/" + food_nr)
	        .then((response) => {
	            //console.log(response.data);
	            $$invalidate('food', food = response.data);
	        })
	        .catch((error) => {
	            console.log(error);
	        });
	    }

	    const handleVote = (vote) => {
	        console.log(vote);

	        dispatch('save-vote', vote);

	    };

		function click_handler() {
			return handleVote(0);
		}

		function click_handler_1() {
			return handleVote(1);
		}

		function click_handler_2() {
			return handleVote(2);
		}

		$$self.$set = $$props => {
			if ('food_nr' in $$props) $$invalidate('food_nr', food_nr = $$props.food_nr);
			if ('onChange' in $$props) $$invalidate('onChange', onChange = $$props.onChange);
		};

		$$self.$$.update = ($$dirty = { food_nr: 1, onChange: 1, food: 1 }) => {
			if ($$dirty.food_nr) { food_nr && update(); }
			if ($$dirty.onChange || $$dirty.food) { onChange(food); }
		};

		return {
			food_nr,
			onChange,
			handleVote,
			click_handler,
			click_handler_1,
			click_handler_2
		};
	}

	class FoodComponent extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance, create_fragment, safe_not_equal, ["food_nr", "onChange"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.food_nr === undefined && !('food_nr' in props)) {
				console.warn("<FoodComponent> was created without expected prop 'food_nr'");
			}
			if (ctx.onChange === undefined && !('onChange' in props)) {
				console.warn("<FoodComponent> was created without expected prop 'onChange'");
			}
		}

		get food_nr() {
			throw new Error("<FoodComponent>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set food_nr(value) {
			throw new Error("<FoodComponent>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get onChange() {
			throw new Error("<FoodComponent>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set onChange(value) {
			throw new Error("<FoodComponent>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\app\component\FormComponent.svelte generated by Svelte v3.1.0 */

	const file$1 = "src\\app\\component\\FormComponent.svelte";

	function create_fragment$1(ctx) {
		var h2, t1, form, div0, label0, t3, input0, t4, div1, label1, t6, input1, t7, div3, label2, t9, div2, input2, t10, div4, button, t11, dispose;

		return {
			c: function create() {
				h2 = element("h2");
				h2.textContent = "Registration Formular";
				t1 = space();
				form = element("form");
				div0 = element("div");
				label0 = element("label");
				label0.textContent = "Username";
				t3 = space();
				input0 = element("input");
				t4 = space();
				div1 = element("div");
				label1 = element("label");
				label1.textContent = "Email address";
				t6 = space();
				input1 = element("input");
				t7 = space();
				div3 = element("div");
				label2 = element("label");
				label2.textContent = "Password";
				t9 = space();
				div2 = element("div");
				input2 = element("input");
				t10 = space();
				div4 = element("div");
				button = element("button");
				t11 = text("Confirm identity");
				add_location(h2, file$1, 91, 0, 1740);
				label0.htmlFor = "usernameInput";
				label0.className = "form-label";
				add_location(label0, file$1, 95, 4, 1822);
				attr(input0, "type", "String");
				input0.className = "form-control";
				input0.id = "usernameInput";
				input0.placeholder = "your username";
				add_location(input0, file$1, 96, 4, 1890);
				div0.className = "mb-3";
				add_location(div0, file$1, 94, 0, 1798);
				label1.htmlFor = "exampleFormControlInput1";
				label1.className = "form-label";
				add_location(label1, file$1, 99, 4, 2067);
				attr(input1, "type", "email");
				input1.className = "form-control";
				input1.id = "exampleFormControlInput1";
				input1.placeholder = "name@example.com";
				add_location(input1, file$1, 100, 4, 2151);
				div1.className = "mb-3";
				add_location(div1, file$1, 98, 0, 2043);
				label2.htmlFor = "inputPassword";
				label2.className = "col-sm-2 col-form-label";
				add_location(label2, file$1, 103, 4, 2349);
				attr(input2, "type", "password");
				input2.className = "form-control";
				input2.id = "inputPassword";
				add_location(input2, file$1, 105, 6, 2461);
				div2.className = "col-sm-10";
				add_location(div2, file$1, 104, 4, 2430);
				div3.className = "mb-3 row";
				add_location(div3, file$1, 102, 0, 2321);
				button.disabled = ctx.disabled;
				button.type = "button";
				button.className = "btn btn-primary mb-3";
				add_location(button, file$1, 109, 4, 2636);
				div4.className = "col-auto";
				add_location(div4, file$1, 108, 2, 2608);
				form.className = "row g-3";
				add_location(form, file$1, 93, 0, 1774);

				dispose = [
					listen(input0, "input", ctx.input0_input_handler),
					listen(input0, "change", ctx.checkUsername),
					listen(input1, "input", ctx.input1_input_handler),
					listen(input1, "change", ctx.checkEmailAdress),
					listen(input2, "input", ctx.input2_input_handler),
					listen(input2, "change", ctx.checkPassword),
					listen(button, "click", ctx.saveUser)
				];
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, h2, anchor);
				insert(target, t1, anchor);
				insert(target, form, anchor);
				append(form, div0);
				append(div0, label0);
				append(div0, t3);
				append(div0, input0);

				input0.value = ctx.user.user_name;

				append(form, t4);
				append(form, div1);
				append(div1, label1);
				append(div1, t6);
				append(div1, input1);

				input1.value = ctx.user.user_email;

				append(form, t7);
				append(form, div3);
				append(div3, label2);
				append(div3, t9);
				append(div3, div2);
				append(div2, input2);

				input2.value = ctx.user.user_password;

				append(form, t10);
				append(form, div4);
				append(div4, button);
				append(button, t11);
			},

			p: function update(changed, ctx) {
				if (changed.user) input0.value = ctx.user.user_name;
				if (changed.user) input1.value = ctx.user.user_email;
				if (changed.user) input2.value = ctx.user.user_password;

				if (changed.disabled) {
					button.disabled = ctx.disabled;
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(h2);
					detach(t1);
					detach(form);
				}

				run_all(dispose);
			}
		};
	}

	let minLength = 4;

	function hasNumbers(t)
	  {
	  var regex = /\d/g;
	  return regex.test(t);
	}

	function instance$1($$self, $$props, $$invalidate) {
		const dispatch = createEventDispatcher();

	let user = {
	    user_name: "",
	    user_email: "",
	    user_password: "",
	    food_ratings: []
	};


	function saveUser(){

	    console.log(user);

	    axios.post('/users', user)
	        .then((response) => {
	            console.log(response.data);
	            localStorage.current_user = JSON.stringify(response.data);
	            console.log(localStorage.current_user);
	            dispatch("logIn", response.data);
	        })
	        .catch((error) => {
	            console.log(error);
	        });
	    
	}


	let check_username = false;

	function checkUsername(){
	        if(user.user_name.length >= minLength){
	            $$invalidate('check_username', check_username = true);
	            check();
	        } else{
	            $$invalidate('check_username', check_username = false);
	        }
	    
	}

	let check_mail = false;

	function checkEmailAdress(){
	    let mail = user.user_email;
	    if(mail.length >= minLength && mail.search("@") != -1 && mail.search(".") != -1){
	        $$invalidate('check_mail', check_mail = true);
	        check();
	    } else{
	        $$invalidate('check_mail', check_mail = false);
	    }

	}

	let check_password = false;

	function checkPassword(){
	    let password = user.user_password;

	    let test = hasNumbers(password);
	    if(password.length >= minLength && test){
	        $$invalidate('check_password', check_password = true);
	        check();

	    } else{
	        $$invalidate('check_password', check_password = false);
	    }

	}   


	let disabled = !(check_password && check_mail && check_username);

	function check(){

	    $$invalidate('disabled', disabled = !(check_password && check_mail && check_username));
	}

		function input0_input_handler() {
			user.user_name = this.value;
			$$invalidate('user', user);
		}

		function input1_input_handler() {
			user.user_email = this.value;
			$$invalidate('user', user);
		}

		function input2_input_handler() {
			user.user_password = this.value;
			$$invalidate('user', user);
		}

		return {
			user,
			saveUser,
			checkUsername,
			checkEmailAdress,
			checkPassword,
			disabled,
			input0_input_handler,
			input1_input_handler,
			input2_input_handler
		};
	}

	class FormComponent extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$1, create_fragment$1, safe_not_equal, []);
		}
	}

	/* src\app\component\LoginComponent.svelte generated by Svelte v3.1.0 */

	const file$2 = "src\\app\\component\\LoginComponent.svelte";

	function create_fragment$2(ctx) {
		var h2, t1, form, div0, label0, t3, input0, t4, div2, label1, t6, div1, input1, t7, div3, button, t8, dispose;

		return {
			c: function create() {
				h2 = element("h2");
				h2.textContent = "Login Formular";
				t1 = space();
				form = element("form");
				div0 = element("div");
				label0 = element("label");
				label0.textContent = "Username";
				t3 = space();
				input0 = element("input");
				t4 = space();
				div2 = element("div");
				label1 = element("label");
				label1.textContent = "Password";
				t6 = space();
				div1 = element("div");
				input1 = element("input");
				t7 = space();
				div3 = element("div");
				button = element("button");
				t8 = text("Confirm");
				add_location(h2, file$2, 87, 4, 2062);
				label0.htmlFor = "usernameInput";
				label0.className = "form-label";
				add_location(label0, file$2, 91, 8, 2153);
				attr(input0, "type", "String");
				input0.className = "form-control";
				input0.id = "usernameInput";
				input0.placeholder = "your username";
				add_location(input0, file$2, 92, 8, 2225);
				div0.className = "mb-3";
				add_location(div0, file$2, 90, 4, 2125);
				label1.htmlFor = "inputPassword";
				label1.className = "col-sm-2 col-form-label";
				add_location(label1, file$2, 95, 8, 2418);
				attr(input1, "type", "password");
				input1.className = "form-control";
				input1.id = "inputPassword";
				add_location(input1, file$2, 97, 10, 2538);
				div1.className = "col-sm-10";
				add_location(div1, file$2, 96, 8, 2503);
				div2.className = "mb-3 row";
				add_location(div2, file$2, 94, 4, 2386);
				button.disabled = ctx.disabled;
				button.type = "button";
				button.className = "btn btn-primary mb-3";
				add_location(button, file$2, 101, 8, 2729);
				div3.className = "col-auto";
				add_location(div3, file$2, 100, 6, 2697);
				form.className = "row g-3";
				add_location(form, file$2, 89, 4, 2097);

				dispose = [
					listen(input0, "input", ctx.input0_input_handler),
					listen(input0, "change", ctx.checkUsername),
					listen(input1, "input", ctx.input1_input_handler),
					listen(input1, "change", ctx.checkPassword),
					listen(button, "click", ctx.checkAccount)
				];
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, h2, anchor);
				insert(target, t1, anchor);
				insert(target, form, anchor);
				append(form, div0);
				append(div0, label0);
				append(div0, t3);
				append(div0, input0);

				input0.value = ctx.user.user_name;

				append(form, t4);
				append(form, div2);
				append(div2, label1);
				append(div2, t6);
				append(div2, div1);
				append(div1, input1);

				input1.value = ctx.user.user_password;

				append(form, t7);
				append(form, div3);
				append(div3, button);
				append(button, t8);
			},

			p: function update(changed, ctx) {
				if (changed.user) input0.value = ctx.user.user_name;
				if (changed.user) input1.value = ctx.user.user_password;

				if (changed.disabled) {
					button.disabled = ctx.disabled;
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(h2);
					detach(t1);
					detach(form);
				}

				run_all(dispose);
			}
		};
	}

	let minLength$1 = 4;

	function hasNumbers$1(t)
	    {
	    var regex = /\d/g;
	    return regex.test(t);
	}

	function instance$2($$self, $$props, $$invalidate) {
		const dispatch = createEventDispatcher();

	    let user = {
	        user_name: "",
	        user_email: "",
	        user_password: "",
	        food_ratings: []
	    };
	    
	    let check_username = false;
	    
	    function checkUsername(){
	        if(user.user_name.length >= minLength$1){
	            $$invalidate('check_username', check_username = true);
	            check();
	        } else{
	            $$invalidate('check_username', check_username = false);
	        }
	    
	    }
	    
	    
	    let check_password = false;
	    
	    function checkPassword(){
	        let password = user.user_password;
	    
	        let test = hasNumbers$1(password);
	        if(password.length >= minLength$1 && test){
	            $$invalidate('check_password', check_password = true);
	            check();
	    
	        } else{
	            $$invalidate('check_password', check_password = false);
	        }
	    
	    }   
	    
	    
	    let disabled = !(check_password && check_username);
	    
	    function check(){
	    
	        $$invalidate('disabled', disabled = !(check_password && check_username));
	    }
	    
	    
	    function checkAccount(){

	        axios.get("users/name/" + user.user_name)
	            .then((response) => {
	            console.log(response.data);
	            const pw = response.data.user_password;
	            if(pw.localeCompare(user.user_password) == 0){

	                localStorage.current_user = JSON.stringify(response.data);
	                console.log(localStorage.current_user);
	                console.log(JSON.parse(localStorage.current_user).user_name);
	                console.log("localStorage gespeichert");
	                dispatch("logIn", response.data);
	                
	            } else{

	                console.log("Username or Password is invalid");
	                
	            }

	            })
	            .catch((error) => {
	                console.log(error);
	            });
	    }

		function input0_input_handler() {
			user.user_name = this.value;
			$$invalidate('user', user);
		}

		function input1_input_handler() {
			user.user_password = this.value;
			$$invalidate('user', user);
		}

		return {
			user,
			checkUsername,
			checkPassword,
			disabled,
			checkAccount,
			input0_input_handler,
			input1_input_handler
		};
	}

	class LoginComponent extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$2, create_fragment$2, safe_not_equal, []);
		}
	}

	/* src\app\component\RouterLink.svelte generated by Svelte v3.1.0 */

	const file$3 = "src\\app\\component\\RouterLink.svelte";

	function create_fragment$3(ctx) {
		var a, a_href_value, current;

		const default_slot_1 = ctx.$$slots.default;
		const default_slot = create_slot(default_slot_1, ctx, null);

		return {
			c: function create() {
				a = element("a");

				if (default_slot) default_slot.c();

				a.href = a_href_value = "#/" + ctx.url;
				a.className = "svelte-1b10eml";
				add_location(a, file$3, 10, 0, 102);
			},

			l: function claim(nodes) {
				if (default_slot) default_slot.l(a_nodes);
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, a, anchor);

				if (default_slot) {
					default_slot.m(a, null);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (default_slot && default_slot.p && changed.$$scope) {
					default_slot.p(get_slot_changes(default_slot_1, ctx, changed,), get_slot_context(default_slot_1, ctx, null));
				}

				if ((!current || changed.url) && a_href_value !== (a_href_value = "#/" + ctx.url)) {
					a.href = a_href_value;
				}
			},

			i: function intro(local) {
				if (current) return;
				if (default_slot && default_slot.i) default_slot.i(local);
				current = true;
			},

			o: function outro(local) {
				if (default_slot && default_slot.o) default_slot.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(a);
				}

				if (default_slot) default_slot.d(detaching);
			}
		};
	}

	function instance$3($$self, $$props, $$invalidate) {
		let { url } = $$props;

		let { $$slots = {}, $$scope } = $$props;

		$$self.$set = $$props => {
			if ('url' in $$props) $$invalidate('url', url = $$props.url);
			if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
		};

		return { url, $$slots, $$scope };
	}

	class RouterLink extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$3, create_fragment$3, safe_not_equal, ["url"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.url === undefined && !('url' in props)) {
				console.warn("<RouterLink> was created without expected prop 'url'");
			}
		}

		get url() {
			throw new Error("<RouterLink>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set url(value) {
			throw new Error("<RouterLink>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	let control;
	try{

	    control = (JSON.parse(localStorage.current_user).user_id == 1);
	} 
	catch{
	    
	    control = (false);
	}


	const admin = writable(control);

	const foodListe = [
	    207,
	    208,
	    34,
	    205,
	    38,
	    66,
	    916
	];


	function resetPage() {
	    window.location.reload();
	}

	/* src\app\component\StartComponent.svelte generated by Svelte v3.1.0 */

	const file$4 = "src\\app\\component\\StartComponent.svelte";

	function create_fragment$4(ctx) {
		var div2, div0, t1, div1, h5, t3, p, t4, t5, t6, t7, a;

		return {
			c: function create() {
				div2 = element("div");
				div0 = element("div");
				div0.textContent = "Fragebogen";
				t1 = space();
				div1 = element("div");
				h5 = element("h5");
				h5.textContent = "Inhalt";
				t3 = space();
				p = element("p");
				t4 = text("Dieser Fragbogen beinhaltet ");
				t5 = text(ctx.count);
				t6 = text(" Lebensmittel. \r\n        Geben Sie bitte an wie gerne Sie einzelne Lebensmittel haben.\r\n        Mit den Angaben wird eine erste Evaluation durchgeführt.");
				t7 = space();
				a = element("a");
				a.textContent = "Starten";
				div0.className = "card-header";
				add_location(div0, file$4, 8, 4, 140);
				h5.className = "card-title";
				add_location(h5, file$4, 12, 6, 234);
				p.className = "card-text";
				add_location(p, file$4, 13, 6, 276);
				a.href = "#/questions";
				a.className = "btn btn-primary";
				add_location(a, file$4, 20, 6, 534);
				div1.className = "card-body";
				add_location(div1, file$4, 11, 4, 203);
				div2.className = "card";
				add_location(div2, file$4, 7, 0, 116);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div2, anchor);
				append(div2, div0);
				append(div2, t1);
				append(div2, div1);
				append(div1, h5);
				append(div1, t3);
				append(div1, p);
				append(p, t4);
				append(p, t5);
				append(p, t6);
				append(div1, t7);
				append(div1, a);
			},

			p: noop,
			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div2);
				}
			}
		};
	}

	function instance$4($$self) {
		let count = foodListe.length;

		return { count };
	}

	class StartComponent extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$4, create_fragment$4, safe_not_equal, []);
		}
	}

	/* src\app\pages\Homepage.svelte generated by Svelte v3.1.0 */

	const file$5 = "src\\app\\pages\\Homepage.svelte";

	// (82:0) {:else}
	function create_else_block_1(ctx) {
		var button, t_1, current, dispose;

		var startcomponent = new StartComponent({ $$inline: true });

		return {
			c: function create() {
				button = element("button");
				button.textContent = "Ausloggen";
				t_1 = space();
				startcomponent.$$.fragment.c();
				button.type = "button";
				button.className = "btn btn-secondary mb-3";
				add_location(button, file$5, 82, 2, 1634);
				dispose = listen(button, "click", ctx.ausloggen);
			},

			m: function mount(target, anchor) {
				insert(target, button, anchor);
				insert(target, t_1, anchor);
				mount_component(startcomponent, target, anchor);
				current = true;
			},

			p: noop,

			i: function intro(local) {
				if (current) return;
				startcomponent.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				startcomponent.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(button);
					detach(t_1);
				}

				startcomponent.$destroy(detaching);

				dispose();
			}
		};
	}

	// (70:0) {#if !loggedIn}
	function create_if_block(ctx) {
		var current_block_type_index, if_block, t0, button, t1, current, dispose;

		var if_block_creators = [
			create_if_block_1,
			create_else_block
		];

		var if_blocks = [];

		function select_block_type_1(ctx) {
			if (ctx.neu) return 0;
			return 1;
		}

		current_block_type_index = select_block_type_1(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c: function create() {
				if_block.c();
				t0 = space();
				button = element("button");
				t1 = text(ctx.text);
				button.type = "button";
				button.className = "btn btn-secondary mb-3";
				add_location(button, file$5, 79, 2, 1531);
				dispose = listen(button, "click", ctx.btnHandler);
			},

			m: function mount(target, anchor) {
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, t0, anchor);
				insert(target, button, anchor);
				append(button, t1);
				current = true;
			},

			p: function update(changed, ctx) {
				var previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type_1(ctx);
				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(changed, ctx);
				} else {
					group_outros();
					on_outro(() => {
						if_blocks[previous_block_index].d(1);
						if_blocks[previous_block_index] = null;
					});
					if_block.o(1);
					check_outros();

					if_block = if_blocks[current_block_type_index];
					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					}
					if_block.i(1);
					if_block.m(t0.parentNode, t0);
				}

				if (!current || changed.text) {
					set_data(t1, ctx.text);
				}
			},

			i: function intro(local) {
				if (current) return;
				if (if_block) if_block.i();
				current = true;
			},

			o: function outro(local) {
				if (if_block) if_block.o();
				current = false;
			},

			d: function destroy(detaching) {
				if_blocks[current_block_type_index].d(detaching);

				if (detaching) {
					detach(t0);
					detach(button);
				}

				dispose();
			}
		};
	}

	// (74:2) {:else}
	function create_else_block(ctx) {
		var current;

		var logincomponent = new LoginComponent({ $$inline: true });
		logincomponent.$on("logIn", ctx.einloggen);

		return {
			c: function create() {
				logincomponent.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(logincomponent, target, anchor);
				current = true;
			},

			p: noop,

			i: function intro(local) {
				if (current) return;
				logincomponent.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				logincomponent.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				logincomponent.$destroy(detaching);
			}
		};
	}

	// (71:2) {#if neu}
	function create_if_block_1(ctx) {
		var current;

		var formcomponent = new FormComponent({ $$inline: true });
		formcomponent.$on("logIn", ctx.einloggen);

		return {
			c: function create() {
				formcomponent.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(formcomponent, target, anchor);
				current = true;
			},

			p: noop,

			i: function intro(local) {
				if (current) return;
				formcomponent.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				formcomponent.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				formcomponent.$destroy(detaching);
			}
		};
	}

	function create_fragment$5(ctx) {
		var h1, t_1, current_block_type_index, if_block, if_block_anchor, current;

		var if_block_creators = [
			create_if_block,
			create_else_block_1
		];

		var if_blocks = [];

		function select_block_type(ctx) {
			if (!ctx.loggedIn) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c: function create() {
				h1 = element("h1");
				h1.textContent = "Home sweet Home";
				t_1 = space();
				if_block.c();
				if_block_anchor = empty();
				add_location(h1, file$5, 67, 0, 1371);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, h1, anchor);
				insert(target, t_1, anchor);
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);
				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(changed, ctx);
				} else {
					group_outros();
					on_outro(() => {
						if_blocks[previous_block_index].d(1);
						if_blocks[previous_block_index] = null;
					});
					if_block.o(1);
					check_outros();

					if_block = if_blocks[current_block_type_index];
					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					}
					if_block.i(1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},

			i: function intro(local) {
				if (current) return;
				if (if_block) if_block.i();
				current = true;
			},

			o: function outro(local) {
				if (if_block) if_block.o();
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(h1);
					detach(t_1);
				}

				if_blocks[current_block_type_index].d(detaching);

				if (detaching) {
					detach(if_block_anchor);
				}
			}
		};
	}

	function setAdmin() {

		admin.set(true);

	}

	function instance$5($$self, $$props, $$invalidate) {
		

	  let neu = true;
	  let text = "Account exists";
	 

	  function btnHandler(){
	  $$invalidate('neu', neu = !neu);

	  if (neu){
	    $$invalidate('text', text = "Login in existing Account");
	  }else{
	    $$invalidate('text', text = "Create new Account");
	  }
	  }

	//let loggedIn = false;
	let loggedIn = localStorage.current_user != null;

	function adminReset(){
	  if (!loggedIn){
	    admin.set(False);
	    console.log(loggedIn);
	  }
	}

	function einloggen(){
	  $$invalidate('loggedIn', loggedIn = true);
	  if (JSON.parse(localStorage.current_user).user_id == 1){
	    setAdmin();
	  }
	}

	function ausloggen(){
	  console.log("logged out");
	  $$invalidate('loggedIn', loggedIn = false);
	  localStorage.clear();
	  resetPage();
	}

		$$self.$$.update = ($$dirty = { loggedIn: 1 }) => {
			if ($$dirty.loggedIn) { loggedIn && adminReset(); }
		};

		$$invalidate('loggedIn', loggedIn = localStorage.current_user != null);

		return {
			neu,
			text,
			btnHandler,
			loggedIn,
			einloggen,
			ausloggen
		};
	}

	class Homepage extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$5, create_fragment$5, safe_not_equal, []);
		}
	}

	/* src\app\pages\Notfound.svelte generated by Svelte v3.1.0 */

	const file$6 = "src\\app\\pages\\Notfound.svelte";

	function create_fragment$6(ctx) {
		var h1;

		return {
			c: function create() {
				h1 = element("h1");
				h1.textContent = "Wrong way, go back.";
				add_location(h1, file$6, 4, 0, 25);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, h1, anchor);
			},

			p: noop,
			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(h1);
				}
			}
		};
	}

	class Notfound extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$6, safe_not_equal, []);
		}
	}

	/* src\app\component\EndComponent.svelte generated by Svelte v3.1.0 */

	const file$7 = "src\\app\\component\\EndComponent.svelte";

	function create_fragment$7(ctx) {
		var div1, h50, t1, div0, h51, t3, p, t4, t5, t6, t7, a;

		return {
			c: function create() {
				div1 = element("div");
				h50 = element("h5");
				h50.textContent = "Ihr Fragebogen";
				t1 = space();
				div0 = element("div");
				h51 = element("h5");
				h51.textContent = "Der Fragebogen wurde beendet.";
				t3 = space();
				p = element("p");
				t4 = text("Sie haben alle ");
				t5 = text(ctx.count);
				t6 = text(" Fragen ausgefüllt.");
				t7 = space();
				a = element("a");
				a.textContent = "Zur Evaluation";
				h50.className = "card-header";
				add_location(h50, file$7, 9, 4, 150);
				h51.className = "card-title";
				add_location(h51, file$7, 11, 6, 230);
				p.className = "card-text";
				add_location(p, file$7, 16, 6, 336);
				a.href = "#/evaluation";
				a.className = "btn btn-primary";
				add_location(a, file$7, 21, 6, 436);
				div0.className = "card-body";
				add_location(div0, file$7, 10, 4, 199);
				div1.className = "card";
				add_location(div1, file$7, 8, 0, 126);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div1, anchor);
				append(div1, h50);
				append(div1, t1);
				append(div1, div0);
				append(div0, h51);
				append(div0, t3);
				append(div0, p);
				append(p, t4);
				append(p, t5);
				append(p, t6);
				append(div0, t7);
				append(div0, a);
			},

			p: noop,
			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div1);
				}
			}
		};
	}

	function instance$6($$self) {
		let count = foodListe.length;

		return { count };
	}

	class EndComponent extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$6, create_fragment$7, safe_not_equal, []);
		}
	}

	/* src\app\pages\Questionspage.svelte generated by Svelte v3.1.0 */

	const file$8 = "src\\app\\pages\\Questionspage.svelte";

	// (1:0) <script>      import { onMount }
	function create_catch_block(ctx) {
		return {
			c: noop,
			m: noop,
			p: noop,
			i: noop,
			o: noop,
			d: noop
		};
	}

	// (87:0) {:then}
	function create_then_block(ctx) {
		var current_block_type_index, if_block, if_block_anchor, current;

		var if_block_creators = [
			create_if_block$1,
			create_else_block$1
		];

		var if_blocks = [];

		function select_block_type(ctx) {
			if (!ctx.endOfList) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c: function create() {
				if_block.c();
				if_block_anchor = empty();
			},

			m: function mount(target, anchor) {
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);
				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(changed, ctx);
				} else {
					group_outros();
					on_outro(() => {
						if_blocks[previous_block_index].d(1);
						if_blocks[previous_block_index] = null;
					});
					if_block.o(1);
					check_outros();

					if_block = if_blocks[current_block_type_index];
					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					}
					if_block.i(1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},

			i: function intro(local) {
				if (current) return;
				if (if_block) if_block.i();
				current = true;
			},

			o: function outro(local) {
				if (if_block) if_block.o();
				current = false;
			},

			d: function destroy(detaching) {
				if_blocks[current_block_type_index].d(detaching);

				if (detaching) {
					detach(if_block_anchor);
				}
			}
		};
	}

	// (90:2) {:else}
	function create_else_block$1(ctx) {
		var current;

		var endcomponent = new EndComponent({ $$inline: true });

		return {
			c: function create() {
				endcomponent.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(endcomponent, target, anchor);
				current = true;
			},

			p: noop,

			i: function intro(local) {
				if (current) return;
				endcomponent.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				endcomponent.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				endcomponent.$destroy(detaching);
			}
		};
	}

	// (88:1) {#if !endOfList}
	function create_if_block$1(ctx) {
		var current;

		var foodcomponent = new FoodComponent({
			props: {
			food_nr: ctx.food_nr,
			onChange: ctx.func
		},
			$$inline: true
		});
		foodcomponent.$on("save-vote", ctx.saveRelation);

		return {
			c: function create() {
				foodcomponent.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(foodcomponent, target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var foodcomponent_changes = {};
				if (changed.food_nr) foodcomponent_changes.food_nr = ctx.food_nr;
				foodcomponent.$set(foodcomponent_changes);
			},

			i: function intro(local) {
				if (current) return;
				foodcomponent.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				foodcomponent.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				foodcomponent.$destroy(detaching);
			}
		};
	}

	// (85:23)    <p>...waiting</p>  {:then}
	function create_pending_block(ctx) {
		var p;

		return {
			c: function create() {
				p = element("p");
				p.textContent = "...waiting";
				add_location(p, file$8, 85, 1, 2000);
			},

			m: function mount(target, anchor) {
				insert(target, p, anchor);
			},

			p: noop,
			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(p);
				}
			}
		};
	}

	function create_fragment$8(ctx) {
		var h1, t_1, await_block_anchor, promise_1, current;

		let info = {
			ctx,
			current: null,
			pending: create_pending_block,
			then: create_then_block,
			catch: create_catch_block,
			value: 'null',
			error: 'null',
			blocks: Array(3)
		};

		handle_promise(promise_1 = ctx.getInformation, info);

		return {
			c: function create() {
				h1 = element("h1");
				h1.textContent = "Questionnaire";
				t_1 = space();
				await_block_anchor = empty();

				info.block.c();
				add_location(h1, file$8, 83, 0, 1950);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, h1, anchor);
				insert(target, t_1, anchor);
				insert(target, await_block_anchor, anchor);

				info.block.m(target, info.anchor = anchor);
				info.mount = () => await_block_anchor.parentNode;
				info.anchor = await_block_anchor;

				current = true;
			},

			p: function update(changed, new_ctx) {
				ctx = new_ctx;
				info.ctx = ctx;

				if (promise_1 !== (promise_1 = ctx.getInformation) && handle_promise(promise_1, info)) ; else {
					info.block.p(changed, assign(assign({}, ctx), info.resolved));
				}
			},

			i: function intro(local) {
				if (current) return;
				info.block.i();
				current = true;
			},

			o: function outro(local) {
				for (let i = 0; i < 3; i += 1) {
					const block = info.blocks[i];
					if (block) block.o();
				}

				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(h1);
					detach(t_1);
					detach(await_block_anchor);
				}

				info.block.d(detaching);
				info = null;
			}
		};
	}

	function instance$7($$self, $$props, $$invalidate) {
		

	  let endOfList = false;
	  let maxIndex =  foodListe.length -1;
	  let index = -1;
	  let food = {};
	  let food_nr = foodListe[0];
	  let user = JSON.parse(localStorage.current_user);
	  let foodRating = {

	    rating: null,
	    food: null,
	    user: null

	  };

	  let newList = [];

	  let promise = getInformation();


	  async function  getInformation(){
	    axios.get("/users/" + user.user_id + "/food_ratings")
	        .then((response) => {
	            $$invalidate('newList', newList = response.data);
	            console.log(newList);
	            if (newList.length >= (maxIndex + 1)){
	              $$invalidate('endOfList', endOfList = true);
	            }else{
	              $$invalidate('endOfList', endOfList = false);
	              $$invalidate('index', index = newList.length - 1);
	              nextFood(); 
	              
	            }    
	            return "1";
	        })
	        .catch((error) => {
	            console.log(error);
	            return "0";
	        });

	  }
	 // onMount(() => getInformation())
	 

	  const saveRelation = (e) => {
	    foodRating.user = user; $$invalidate('foodRating', foodRating);
	    foodRating.food = food; $$invalidate('foodRating', foodRating);
	    foodRating.rating = e.detail; $$invalidate('foodRating', foodRating);
	    axios.post("/food_ratings/" + foodRating.user.user_id + "/" + foodRating.food.food_id + "/" + foodRating.rating)
	          .then((response) => {
	            console.log(response.data);
	            nextFood();
	          })
	          .catch((error) => {
	              console.log(error);
	          });
	  };


	  const nextFood = () =>{
	    $$invalidate('index', index = index + 1);

	    if (index < maxIndex + 1){
	      
	      $$invalidate('food_nr', food_nr = foodListe[index]);
	      
	    } else{
	      $$invalidate('endOfList', endOfList = true);
	    }

	  };

		function func(newFood) {
			const $$result = food = newFood;
			$$invalidate('food', food);
			return $$result;
		}

		return {
			endOfList,
			food,
			food_nr,
			getInformation,
			saveRelation,
			func
		};
	}

	class Questionspage extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$7, create_fragment$8, safe_not_equal, []);
		}
	}

	/* src\app\evaluation\EvaluationComponent.svelte generated by Svelte v3.1.0 */

	const file$9 = "src\\app\\evaluation\\EvaluationComponent.svelte";

	function create_fragment$9(ctx) {
		var div1, h50, t0, t1_value = ctx.evaluation[0], t1, t2, div0, h51, t3, t4_value = ctx.evaluation[2], t4, t5, p0, t6, t7_value = ctx.evaluation[1], t7, t8, p1, t9, t10_value = ctx.evaluation[3], t10, t11, p2, t12, t13_value = ctx.evaluation[4], t13, t14, p3, t15, t16_value = ctx.evaluation[5], t16, t17, p4, t18, t19_value = ctx.evaluation[6], t19;

		return {
			c: function create() {
				div1 = element("div");
				h50 = element("h5");
				t0 = text("Kategorie: ");
				t1 = text(t1_value);
				t2 = space();
				div0 = element("div");
				h51 = element("h5");
				t3 = text("Anzahl Ratings in dieser Kategorie: ");
				t4 = text(t4_value);
				t5 = space();
				p0 = element("p");
				t6 = text("Summe aller Ratings in dieser Kategorie: ");
				t7 = text(t7_value);
				t8 = space();
				p1 = element("p");
				t9 = text("Durchschnittliches Rating in dieser Kategorie: ");
				t10 = text(t10_value);
				t11 = space();
				p2 = element("p");
				t12 = text("Anzahl dislikes: ");
				t13 = text(t13_value);
				t14 = space();
				p3 = element("p");
				t15 = text("Anzahl likes: ");
				t16 = text(t16_value);
				t17 = space();
				p4 = element("p");
				t18 = text("Anzahl superlikes: ");
				t19 = text(t19_value);
				h50.className = "card-header";
				add_location(h50, file$9, 11, 4, 148);
				h51.className = "card-title";
				add_location(h51, file$9, 13, 6, 240);
				p0.className = "card-text";
				add_location(p0, file$9, 14, 6, 327);
				p1.className = "card-text";
				add_location(p1, file$9, 15, 6, 416);
				p2.className = "card-text";
				add_location(p2, file$9, 16, 6, 511);
				p3.className = "card-text";
				add_location(p3, file$9, 17, 6, 576);
				p4.className = "card-text";
				add_location(p4, file$9, 18, 6, 638);
				div0.className = "card-body";
				add_location(div0, file$9, 12, 4, 209);
				div1.className = "card border-dark mb-3 r";
				set_style(div1, "max-width", "18rem");
				add_location(div1, file$9, 10, 0, 78);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div1, anchor);
				append(div1, h50);
				append(h50, t0);
				append(h50, t1);
				append(div1, t2);
				append(div1, div0);
				append(div0, h51);
				append(h51, t3);
				append(h51, t4);
				append(div0, t5);
				append(div0, p0);
				append(p0, t6);
				append(p0, t7);
				append(div0, t8);
				append(div0, p1);
				append(p1, t9);
				append(p1, t10);
				append(div0, t11);
				append(div0, p2);
				append(p2, t12);
				append(p2, t13);
				append(div0, t14);
				append(div0, p3);
				append(p3, t15);
				append(p3, t16);
				append(div0, t17);
				append(div0, p4);
				append(p4, t18);
				append(p4, t19);
			},

			p: function update(changed, ctx) {
				if ((changed.evaluation) && t1_value !== (t1_value = ctx.evaluation[0])) {
					set_data(t1, t1_value);
				}

				if ((changed.evaluation) && t4_value !== (t4_value = ctx.evaluation[2])) {
					set_data(t4, t4_value);
				}

				if ((changed.evaluation) && t7_value !== (t7_value = ctx.evaluation[1])) {
					set_data(t7, t7_value);
				}

				if ((changed.evaluation) && t10_value !== (t10_value = ctx.evaluation[3])) {
					set_data(t10, t10_value);
				}

				if ((changed.evaluation) && t13_value !== (t13_value = ctx.evaluation[4])) {
					set_data(t13, t13_value);
				}

				if ((changed.evaluation) && t16_value !== (t16_value = ctx.evaluation[5])) {
					set_data(t16, t16_value);
				}

				if ((changed.evaluation) && t19_value !== (t19_value = ctx.evaluation[6])) {
					set_data(t19, t19_value);
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div1);
				}
			}
		};
	}

	function instance$8($$self, $$props, $$invalidate) {
		let { user, evaluation } = $$props;

		$$self.$set = $$props => {
			if ('user' in $$props) $$invalidate('user', user = $$props.user);
			if ('evaluation' in $$props) $$invalidate('evaluation', evaluation = $$props.evaluation);
		};

		return { user, evaluation };
	}

	class EvaluationComponent extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$8, create_fragment$9, safe_not_equal, ["user", "evaluation"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.user === undefined && !('user' in props)) {
				console.warn("<EvaluationComponent> was created without expected prop 'user'");
			}
			if (ctx.evaluation === undefined && !('evaluation' in props)) {
				console.warn("<EvaluationComponent> was created without expected prop 'evaluation'");
			}
		}

		get user() {
			throw new Error("<EvaluationComponent>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set user(value) {
			throw new Error("<EvaluationComponent>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get evaluation() {
			throw new Error("<EvaluationComponent>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set evaluation(value) {
			throw new Error("<EvaluationComponent>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\app\pages\Evaluationpage.svelte generated by Svelte v3.1.0 */

	const file$a = "src\\app\\pages\\Evaluationpage.svelte";

	function get_each_context(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.foodRating = list[i];
		return child_ctx;
	}

	function get_each_context_1(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.evaluation = list[i];
		return child_ctx;
	}

	// (72:0) {#each listEvaluation as evaluation}
	function create_each_block_1(ctx) {
		var current;

		var evaluationcomponent = new EvaluationComponent({
			props: {
			user: ctx.user,
			evaluation: ctx.evaluation
		},
			$$inline: true
		});

		return {
			c: function create() {
				evaluationcomponent.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(evaluationcomponent, target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var evaluationcomponent_changes = {};
				if (changed.user) evaluationcomponent_changes.user = ctx.user;
				if (changed.listEvaluation) evaluationcomponent_changes.evaluation = ctx.evaluation;
				evaluationcomponent.$set(evaluationcomponent_changes);
			},

			i: function intro(local) {
				if (current) return;
				evaluationcomponent.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				evaluationcomponent.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				evaluationcomponent.$destroy(detaching);
			}
		};
	}

	// (87:6) {#each newList as foodRating}
	function create_each_block(ctx) {
		var tr, th, t0_value = ctx.foodRating.id, t0, t1, td0, t2_value = ctx.foodRating.food.food_name, t2, t3, td1, t4_value = ctx.foodRating.food.category, t4, t5, td2, t6_value = ctx.foodRating.rating, t6, t7;

		return {
			c: function create() {
				tr = element("tr");
				th = element("th");
				t0 = text(t0_value);
				t1 = space();
				td0 = element("td");
				t2 = text(t2_value);
				t3 = space();
				td1 = element("td");
				t4 = text(t4_value);
				t5 = space();
				td2 = element("td");
				t6 = text(t6_value);
				t7 = space();
				th.scope = "row";
				add_location(th, file$a, 88, 12, 1906);
				add_location(td0, file$a, 89, 12, 1956);
				add_location(td1, file$a, 90, 12, 2007);
				add_location(td2, file$a, 91, 12, 2057);
				add_location(tr, file$a, 87, 8, 1888);
			},

			m: function mount(target, anchor) {
				insert(target, tr, anchor);
				append(tr, th);
				append(th, t0);
				append(tr, t1);
				append(tr, td0);
				append(td0, t2);
				append(tr, t3);
				append(tr, td1);
				append(td1, t4);
				append(tr, t5);
				append(tr, td2);
				append(td2, t6);
				append(tr, t7);
			},

			p: function update(changed, ctx) {
				if ((changed.newList) && t0_value !== (t0_value = ctx.foodRating.id)) {
					set_data(t0, t0_value);
				}

				if ((changed.newList) && t2_value !== (t2_value = ctx.foodRating.food.food_name)) {
					set_data(t2, t2_value);
				}

				if ((changed.newList) && t4_value !== (t4_value = ctx.foodRating.food.category)) {
					set_data(t4, t4_value);
				}

				if ((changed.newList) && t6_value !== (t6_value = ctx.foodRating.rating)) {
					set_data(t6, t6_value);
				}
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(tr);
				}
			}
		};
	}

	function create_fragment$a(ctx) {
		var h10, t1, t2, h11, t4, table, thead, tr, th0, t6, th1, t8, th2, t10, th3, t12, tbody, current;

		var each_value_1 = ctx.listEvaluation;

		var each_blocks_1 = [];

		for (var i = 0; i < each_value_1.length; i += 1) {
			each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
		}

		function outro_block(i, detaching, local) {
			if (each_blocks_1[i]) {
				if (detaching) {
					on_outro(() => {
						each_blocks_1[i].d(detaching);
						each_blocks_1[i] = null;
					});
				}

				each_blocks_1[i].o(local);
			}
		}

		var each_value = ctx.newList;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
		}

		return {
			c: function create() {
				h10 = element("h1");
				h10.textContent = "Evaluation";
				t1 = space();

				for (var i = 0; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].c();
				}

				t2 = space();
				h11 = element("h1");
				h11.textContent = "Ratings";
				t4 = space();
				table = element("table");
				thead = element("thead");
				tr = element("tr");
				th0 = element("th");
				th0.textContent = "#";
				t6 = space();
				th1 = element("th");
				th1.textContent = "Name";
				t8 = space();
				th2 = element("th");
				th2.textContent = "Category";
				t10 = space();
				th3 = element("th");
				th3.textContent = "Rating";
				t12 = space();
				tbody = element("tbody");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
				add_location(h10, file$a, 69, 0, 1441);
				add_location(h11, file$a, 75, 0, 1594);
				th0.scope = "col";
				add_location(th0, file$a, 79, 8, 1668);
				th1.scope = "col";
				add_location(th1, file$a, 80, 8, 1700);
				th2.scope = "col";
				add_location(th2, file$a, 81, 8, 1735);
				th3.scope = "col";
				add_location(th3, file$a, 82, 8, 1774);
				add_location(tr, file$a, 78, 6, 1654);
				add_location(thead, file$a, 77, 4, 1639);
				add_location(tbody, file$a, 85, 4, 1834);
				table.className = "table";
				add_location(table, file$a, 76, 0, 1612);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, h10, anchor);
				insert(target, t1, anchor);

				for (var i = 0; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].m(target, anchor);
				}

				insert(target, t2, anchor);
				insert(target, h11, anchor);
				insert(target, t4, anchor);
				insert(target, table, anchor);
				append(table, thead);
				append(thead, tr);
				append(tr, th0);
				append(tr, t6);
				append(tr, th1);
				append(tr, t8);
				append(tr, th2);
				append(tr, t10);
				append(tr, th3);
				append(table, t12);
				append(table, tbody);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(tbody, null);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (changed.user || changed.listEvaluation) {
					each_value_1 = ctx.listEvaluation;

					for (var i = 0; i < each_value_1.length; i += 1) {
						const child_ctx = get_each_context_1(ctx, each_value_1, i);

						if (each_blocks_1[i]) {
							each_blocks_1[i].p(changed, child_ctx);
							each_blocks_1[i].i(1);
						} else {
							each_blocks_1[i] = create_each_block_1(child_ctx);
							each_blocks_1[i].c();
							each_blocks_1[i].i(1);
							each_blocks_1[i].m(t2.parentNode, t2);
						}
					}

					group_outros();
					for (; i < each_blocks_1.length; i += 1) outro_block(i, 1, 1);
					check_outros();
				}

				if (changed.newList) {
					each_value = ctx.newList;

					for (var i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(tbody, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}
			},

			i: function intro(local) {
				if (current) return;
				for (var i = 0; i < each_value_1.length; i += 1) each_blocks_1[i].i();

				current = true;
			},

			o: function outro(local) {
				each_blocks_1 = each_blocks_1.filter(Boolean);
				for (let i = 0; i < each_blocks_1.length; i += 1) outro_block(i, 0);

				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(h10);
					detach(t1);
				}

				destroy_each(each_blocks_1, detaching);

				if (detaching) {
					detach(t2);
					detach(h11);
					detach(t4);
					detach(table);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	function instance$9($$self, $$props, $$invalidate) {
		let user = JSON.parse(localStorage.current_user);
	    let newList = [];
	    let listEvaluation = [];

	   
	        axios.get("/food_ratings/users/" + user.user_id + "/string")
	        .then((response) => {
	            console.log(response.data);
	            $$invalidate('listEvaluation', listEvaluation = response.data);
	            
	        })
	        .catch((error) => {
	            console.log(error);
	        });
	    



	    /*class Evaluation {

	      constructor

	      (category, anzahl_0, anzahl_1, anzahl_2, anzahl_total, summe, durchschnitt) 

	      { 

	        this.category = category;
	        this.anzahl_0 = anzahl_0;
	        this.anzahl_1 = anzahl_1;
	        this.anzahl_2 = anzahl_2;
	        this.anzahl_total = anzahl_total;
	        this.summe = summe,
	        this.durchschnitt = durchschnitt

	      }
	     
	      }*/


	   

	    axios.get("/users/" + user.user_id + "/food_ratings")
	        .then((response) => {
	            console.log(response.data);
	            $$invalidate('newList', newList = response.data);

	            //const newEv = new Evaluation();
	             //listEvaluation = [...listEvaluation, newEv];

	         })
	        .catch((error) => {
	            console.log(error);
	        });

		return { user, newList, listEvaluation };
	}

	class Evaluationpage extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$9, create_fragment$a, safe_not_equal, []);
		}
	}

	/* src\app\routing\Router.svelte generated by Svelte v3.1.0 */

	const file$b = "src\\app\\routing\\Router.svelte";

	function create_fragment$b(ctx) {
		var main, current;

		var switch_value = ctx.value;

		function switch_props(ctx) {
			return { $$inline: true };
		}

		if (switch_value) {
			var switch_instance = new switch_value(switch_props(ctx));
		}

		return {
			c: function create() {
				main = element("main");
				if (switch_instance) switch_instance.$$.fragment.c();
				main.className = "svelte-1arjn8m";
				add_location(main, file$b, 35, 0, 768);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, main, anchor);

				if (switch_instance) {
					mount_component(switch_instance, main, null);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (switch_value !== (switch_value = ctx.value)) {
					if (switch_instance) {
						group_outros();
						const old_component = switch_instance;
						on_outro(() => {
							old_component.$destroy();
						});
						old_component.$$.fragment.o(1);
						check_outros();
					}

					if (switch_value) {
						switch_instance = new switch_value(switch_props(ctx));

						switch_instance.$$.fragment.c();
						switch_instance.$$.fragment.i(1);
						mount_component(switch_instance, main, null);
					} else {
						switch_instance = null;
					}
				}
			},

			i: function intro(local) {
				if (current) return;
				if (switch_instance) switch_instance.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				if (switch_instance) switch_instance.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(main);
				}

				if (switch_instance) switch_instance.$destroy();
			}
		};
	}

	function instance$a($$self, $$props, $$invalidate) {
		

	  let value = Notfound;

	  hash.subscribe( valu => {
	    switch(valu) {
	      case '':
	        $$invalidate('value', value = Homepage);
	        break;
	        case 'questions':
	        $$invalidate('value', value = Questionspage);
	        break;
	        case 'evaluation':
	        $$invalidate('value', value = Evaluationpage);
	        break;
	      default:
	        $$invalidate('value', value = Notfound);
	    }
	  });

		return { value };
	}

	class Router extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$a, create_fragment$b, safe_not_equal, []);
		}
	}

	/* src\app\component\Sidenav.svelte generated by Svelte v3.1.0 */

	const file$c = "src\\app\\component\\Sidenav.svelte";

	// (27:6) <RouterLink url=''>
	function create_default_slot_2(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Homepage");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (31:6) <RouterLink url='questions'>
	function create_default_slot_1(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Survey");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (35:6) <RouterLink url='evaluation'>
	function create_default_slot(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Evaluation");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	function create_fragment$c(ctx) {
		var nav, h1, t1, ul, li0, t2, li1, t3, li2, current;

		var routerlink0 = new RouterLink({
			props: {
			url: "",
			$$slots: { default: [create_default_slot_2] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		var routerlink1 = new RouterLink({
			props: {
			url: "questions",
			$$slots: { default: [create_default_slot_1] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		var routerlink2 = new RouterLink({
			props: {
			url: "evaluation",
			$$slots: { default: [create_default_slot] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		return {
			c: function create() {
				nav = element("nav");
				h1 = element("h1");
				h1.textContent = "Sidenav";
				t1 = space();
				ul = element("ul");
				li0 = element("li");
				routerlink0.$$.fragment.c();
				t2 = space();
				li1 = element("li");
				routerlink1.$$.fragment.c();
				t3 = space();
				li2 = element("li");
				routerlink2.$$.fragment.c();
				add_location(h1, file$c, 22, 2, 305);
				li0.className = "svelte-z3uaim";
				add_location(li0, file$c, 25, 4, 334);
				li1.className = "svelte-z3uaim";
				add_location(li1, file$c, 29, 4, 401);
				li2.className = "svelte-z3uaim";
				add_location(li2, file$c, 33, 4, 475);
				ul.className = "svelte-z3uaim";
				add_location(ul, file$c, 23, 2, 324);
				nav.className = "svelte-z3uaim";
				add_location(nav, file$c, 21, 0, 297);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, nav, anchor);
				append(nav, h1);
				append(nav, t1);
				append(nav, ul);
				append(ul, li0);
				mount_component(routerlink0, li0, null);
				append(ul, t2);
				append(ul, li1);
				mount_component(routerlink1, li1, null);
				append(ul, t3);
				append(ul, li2);
				mount_component(routerlink2, li2, null);
				current = true;
			},

			p: function update(changed, ctx) {
				var routerlink0_changes = {};
				if (changed.$$scope) routerlink0_changes.$$scope = { changed, ctx };
				routerlink0.$set(routerlink0_changes);

				var routerlink1_changes = {};
				if (changed.$$scope) routerlink1_changes.$$scope = { changed, ctx };
				routerlink1.$set(routerlink1_changes);

				var routerlink2_changes = {};
				if (changed.$$scope) routerlink2_changes.$$scope = { changed, ctx };
				routerlink2.$set(routerlink2_changes);
			},

			i: function intro(local) {
				if (current) return;
				routerlink0.$$.fragment.i(local);

				routerlink1.$$.fragment.i(local);

				routerlink2.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				routerlink0.$$.fragment.o(local);
				routerlink1.$$.fragment.o(local);
				routerlink2.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(nav);
				}

				routerlink0.$destroy();

				routerlink1.$destroy();

				routerlink2.$destroy();
			}
		};
	}

	class Sidenav extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$c, safe_not_equal, []);
		}
	}

	/* src\App.svelte generated by Svelte v3.1.0 */

	const file$d = "src\\App.svelte";

	// (26:2) {#if adminRigths}
	function create_if_block$2(ctx) {
		var current;

		var sidenav = new Sidenav({
			props: { class: "sidenav" },
			$$inline: true
		});

		return {
			c: function create() {
				sidenav.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(sidenav, target, anchor);
				current = true;
			},

			i: function intro(local) {
				if (current) return;
				sidenav.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				sidenav.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				sidenav.$destroy(detaching);
			}
		};
	}

	function create_fragment$d(ctx) {
		var div, t, current;

		var if_block = (ctx.adminRigths) && create_if_block$2(ctx);

		var router = new Router({ $$inline: true });

		return {
			c: function create() {
				div = element("div");
				if (if_block) if_block.c();
				t = space();
				router.$$.fragment.c();
				div.className = "app-shell svelte-h5712t";
				add_location(div, file$d, 24, 0, 389);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				if (if_block) if_block.m(div, null);
				append(div, t);
				mount_component(router, div, null);
				current = true;
			},

			p: function update(changed, ctx) {
				if (ctx.adminRigths) {
					if (!if_block) {
						if_block = create_if_block$2(ctx);
						if_block.c();
						if_block.i(1);
						if_block.m(div, t);
					} else {
										if_block.i(1);
					}
				} else if (if_block) {
					group_outros();
					on_outro(() => {
						if_block.d(1);
						if_block = null;
					});

					if_block.o(1);
					check_outros();
				}
			},

			i: function intro(local) {
				if (current) return;
				if (if_block) if_block.i();

				router.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				if (if_block) if_block.o();
				router.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				if (if_block) if_block.d();

				router.$destroy();
			}
		};
	}

	function instance$b($$self, $$props, $$invalidate) {
		

	  let adminRigths;

	  admin.subscribe(value => {
			$$invalidate('adminRigths', adminRigths = value);
		});

		return { adminRigths };
	}

	class App extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$b, create_fragment$d, safe_not_equal, []);
		}
	}

	const app = new App({
		target: document.body.querySelector('#app')
	});

	return app;

}());
//# sourceMappingURL=bundle.js.map
