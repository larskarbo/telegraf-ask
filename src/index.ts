
export interface Alternative {
	text: string;
	value: any;
	id?: string
}

export interface Question {
	text: string;
	key: string;
	validateFn?: (x: string) => false | any;
	alternatives: Alternative[];
}

declare module "telegraf" {
	interface Context {
		scene: any
	}
}

import { v4 as uuidv4 } from "uuid";

import Telegraf, { Markup, Context } from "telegraf";
var arrayChunk = require('array-chunk');



export default class Quiz {
	questionIndex: number;
	answers: {
		[property: string]: any;
	};
	questions: Array<Question>;
	ctx: Context
	bot: Telegraf<Context>
	onFinish: Function
	lastQuestion: any
	running: boolean

	constructor(props: any) {
		this.questionIndex = -1
		this.answers = props.answers
		this.questions = props.questions
		this.ctx = props.ctx
		this.bot = props.bot
		this.onFinish = () => { }

		this.running = true
	}

	startQuiz = (onFinish: Function) => {
		this.onFinish = onFinish
		this.nextQuestion()
	}

	confirmationMessage = async () => {
		const uid = uuidv4()
		const msg = await this.ctx.reply(
			"Finish!",
			Markup.inlineKeyboard([Markup.callbackButton("Save", uid)]).extra()
		);

		this.bot.action(uid, async ctx => {
			await ctx.tg.deleteMessage(msg.chat.id, msg.message_id)
			this.running = false
			this.onFinish(this.answers)
		})
	}

	updatePreview = async () => {
		// this.ctx.reply(this.questions.map(q => q.text + " " + this.answers[q.key]).join("\n\n"))


	}

	nextQuestion = async () => {
		const { ctx, bot } = this
		this.updatePreview()
		const questions = this.questions;
		this.questionIndex += 1;
		const thisIndex = this.questionIndex;
		if (thisIndex >= questions.length) {
			return this.confirmationMessage();
		}
		const q = questions[this.questionIndex];
		console.log('this.answers: ', this.answers);
		if (this.answers[q.key]) {
			await ctx.reply(q.key + ": " + this.answers[q.key]);
			this.nextQuestion();
			return
		}
		const alts = q.alternatives.map(a => ({
			...a,
			id: uuidv4()
		}));

		alts.forEach(a => {
			bot.action(a.id, async (ctx: Context) => {
				await ctx.answerCbQuery();
				this.answers[q.key] = a.value;
				ctx
					.editMessageReplyMarkup(this.keyboard(alts, this.answers[q.key]))
					.catch(() => { });
				if (thisIndex == this.questionIndex) {
					if (ctx.chat) {

						// await ctx.tg.deleteMessage(ctx.chat.id, this.lastQuestion.message_id)
					}
					this.nextQuestion();
				}
			});
		});


		bot.use(async (ctx, next) => {
			// await ctx.tg.deleteMessage(msg.chat.id, msg.message_id)
			if (!this.running) {
				next()
				return
			}
			const questions = this.questions;
			const currentQuestion = questions[this.questionIndex];

			console.log('q: ', q);
			if (ctx.updateSubTypes.includes("text") && currentQuestion.key == q.key) {
				ctx.reply(ctx.updateType)
				console.log('q.key: ', q.key);
				console.log('currentQuestion.key: ', currentQuestion.key);
				if (q.validateFn && ctx.message && ctx.message.text) {
					if (q.validateFn(ctx.message.text)) {
						this.answers[q.key] = ctx.message.text;
						return this.nextQuestion();
					} else {
						return ctx.reply("We couldn't understand that answer...!");
					}
				}
			}

			next()
		})

		this.lastQuestion = await ctx.reply(q.text, this.keyboard(alts, this.answers[q.key]).extra());
	}

	keyboard = (alternatives: Alternative[], value: any) => {
		return Markup.inlineKeyboard(
			arrayChunk(alternatives.map(alt => {
				if (!alt.id) {
					throw new Error("please add id!");
				}
				return Markup.callbackButton(
					value === alt.value ? `→ ${alt.text} ←` : alt.text,
					alt.id
				);
			}), 2)
		);
	};

}
